import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const parseModulePath = pathToFileURL(
  path.join(process.cwd(), "node_modules", "csv-parse", "dist", "esm", "sync.js"),
).href;
const { parse } = await import(parseModulePath);

const root = process.cwd();
const ITEMS_FILE = path.join(root, "DATA", "ITEMS.csv");
const OPERATIONS_FILE = path.join(root, "DATA", "Operations - Invoicing - V2.csv");
const OUT_FILE = path.join(root, "C_tmp_catalog_seed.sql");

const ITEM_NAME_ALIASES = {
  brazing: "Materials - Brazing",
  contactor: "Contactor - 24/240V",
  "draft assembly": "Draft Inducer Assembly",
  "limit / sequencer": "Limit/Sequencer",
  minimal: "Materials - Minimal",
  "press switch": "Pressure Switch",
  "rev valve": "Reversing Valve",
  standard: "Materials - Standard",
};

function normalizeKey(value) {
  return (value ?? "").trim().toLowerCase();
}

function getRowValue(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseMoney(value) {
  const text = (value ?? "").trim().replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "");
  if (!text) return 0;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumber(value) {
  const text = (value ?? "").trim();
  if (!text) return 0;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value) {
  return normalizeKey(value) === "true";
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function isEquipmentName(name) {
  const normalized = normalizeKey(name);
  return normalized === "ahu" || normalized === "furnace" || normalized === "heat pump" || normalized === "condenser";
}

function mapItemType(name, category) {
  const normalizedName = normalizeKey(name);
  const normalizedCategory = normalizeKey(category);

  if (normalizedName.includes("labor")) return "labor";
  if (normalizedName === "profit") return "profit";
  if (normalizedCategory === "equipment" || isEquipmentName(name)) return "equipment";
  if (normalizedCategory === "materials" || normalizedCategory === "refrigerant") return "material_bundle";
  return "part";
}

function defaultUnitForType(type) {
  if (type === "labor") return "hour";
  return "each";
}

function buildItemPayload(name, category, unitCost) {
  const type = mapItemType(name, category);
  return {
    name,
    type,
    unit_cost: roundMoney(unitCost),
    is_placeholder: unitCost <= 0 && type !== "labor" && type !== "profit",
    unit: type === "material_bundle" && normalizeKey(category) === "refrigerant"
      ? "lb"
      : defaultUnitForType(type),
    alacarte_eligible: type !== "labor" && type !== "profit",
    active: true,
  };
}

function resolveOperationItemName(rawName, unitCost, column) {
  if (!rawName) return null;

  const normalized = normalizeKey(rawName);
  if (column === "refrigerant") {
    if (Math.abs(unitCost - 18) < 0.01) return "R32 Refrigerant";
    if (Math.abs(unitCost - 15) < 0.01) return "R410A Refrigerant";
    return "Refrigerant";
  }

  if (normalized === "motor") {
    return Math.abs(unitCost - 70) < 0.01 ? "Condenser Motor" : "Blower Motor";
  }

  if (normalized === "install") return "Materials - Install";
  return ITEM_NAME_ALIASES[normalized] ?? rawName.trim();
}

function inferCategoryForOperationItem(name, column) {
  if (column === "materials") return "Materials";
  if (column === "refrigerant") return "Refrigerant";
  if (isEquipmentName(name)) return "Equipment";
  if (normalizeKey(name).includes("labor")) return "Services";
  if (normalizeKey(name) === "profit") return "Services";
  return "Imported";
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const itemsRows = parse(await fs.readFile(ITEMS_FILE, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const rawRows = parse(await fs.readFile(OPERATIONS_FILE, "utf8"), {
  relax_column_count: true,
  skip_empty_lines: false,
});

const header = rawRows[1] ?? [];
const operationRows = rawRows
  .slice(2)
  .map((row) => Object.fromEntries(header.map((column, index) => [column, (row[index] ?? "").trim()])))
  .filter((row) => row["Repair Code"]);

const statements = ["-- Generated catalog seed for live import", "begin;"];
const allItems = new Map();

for (const row of itemsRows) {
  const name = row["Product/Service Name"]?.trim();
  if (!name) continue;
  allItems.set(normalizeKey(name), {
    name,
    category: row.Category ?? "",
    cost: parseMoney(row.Cost),
  });
}

for (const row of operationRows) {
  for (const partCol of ["Part 1", "Part 2", "Part 3"]) {
    const rawName = row[partCol];
    if (!rawName) continue;
    const resolved = resolveOperationItemName(rawName, parseMoney(row[`${partCol} $`]), "part");
    if (!resolved) continue;
    const cost = parseMoney(row[`${partCol} $`]);
    if (!allItems.has(normalizeKey(resolved))) {
      allItems.set(normalizeKey(resolved), {
        name: resolved,
        category: inferCategoryForOperationItem(resolved, "part"),
        cost,
      });
    }
  }

  const materialName = getRowValue(row, "Materials");
  const materialCost = parseMoney(getRowValue(row, "Material $"));
  if (materialName && materialCost > 0) {
    const resolved = resolveOperationItemName(materialName, materialCost, "materials");
    if (resolved && !allItems.has(normalizeKey(resolved))) {
      allItems.set(normalizeKey(resolved), {
        name: resolved,
        category: inferCategoryForOperationItem(resolved, "materials"),
        cost: materialCost,
      });
    }
  }

  const refrigerantQty = parseNumber(getRowValue(row, "Refrigerant"));
  const refrigerantCost = parseMoney(getRowValue(row, "Refrigerant $"));
  if (refrigerantQty > 0 && refrigerantCost > 0) {
    const unitCost = roundMoney(refrigerantCost / refrigerantQty);
    const resolved = resolveOperationItemName(getRowValue(row, "Refrigerant"), unitCost, "refrigerant");
    if (resolved && !allItems.has(normalizeKey(resolved))) {
      allItems.set(normalizeKey(resolved), {
        name: resolved,
        category: inferCategoryForOperationItem(resolved, "refrigerant"),
        cost: unitCost,
      });
    }
  }
}

allItems.set(normalizeKey("Labor - Hour"), { name: "Labor - Hour", category: "Services", cost: 90 });
allItems.set(normalizeKey("Profit"), { name: "Profit", category: "Services", cost: 0 });

for (const item of allItems.values()) {
  const payload = buildItemPayload(item.name, item.category, item.cost);
  statements.push(`do $$
declare v_item_id uuid;
begin
  select id into v_item_id from public.items where lower(name) = lower(${sql(payload.name)}) order by created_at limit 1;
  if v_item_id is null then
    insert into public.items (name, type, unit_cost, is_placeholder, unit, alacarte_eligible, active)
    values (${sql(payload.name)}, ${sql(payload.type)}, ${sql(payload.unit_cost)}, ${sql(payload.is_placeholder)}, ${sql(payload.unit)}, ${sql(payload.alacarte_eligible)}, ${sql(payload.active)});
  else
    update public.items
    set type = ${sql(payload.type)},
        unit_cost = ${sql(payload.unit_cost)},
        is_placeholder = ${sql(payload.is_placeholder)},
        unit = ${sql(payload.unit)},
        alacarte_eligible = ${sql(payload.alacarte_eligible)},
        active = ${sql(payload.active)}
    where id = v_item_id;
  end if;
end $$;`);
}

for (const row of operationRows) {
  const location = getRowValue(row, "Location");
  const component = getRowValue(row, "Component");
  const action = getRowValue(row, "Action");
  const cat1 = getRowValue(row, "Cat 1") || null;
  const cat2 = getRowValue(row, "Cat 2") || null;
  const cat3 = getRowValue(row, "Cat 3") || null;

  const diagnosisPayload = {
    location,
    component,
    action,
    cat1,
    cat2,
    cat3,
    repair_notes: getRowValue(row, "Repair Notes") || null,
    invoice_description: getRowValue(row, "QB Repair Description") || null,
    variable_pricing: parseBoolean(getRowValue(row, "Variable")),
    one_shot: parseBoolean(getRowValue(row, "One Shot")),
    est_work_hours: parseNumber(getRowValue(row, "Total Time")) || null,
    historic_price: parseMoney(getRowValue(row, "Historic Price", "Flat Rate")) || null,
    active: true,
  };

  const bundlePayload = {
    name: getRowValue(row, "Repair Code"),
    flat_rate: parseMoney(getRowValue(row, "Flat Rate", "Historic Price")) || null,
    travel_time_hours: parseNumber(getRowValue(row, "Travel Time")) || null,
    work_time_hours: parseNumber(getRowValue(row, "Work Time")) || null,
    total_time_hours: parseNumber(getRowValue(row, "Total Time")) || null,
    labor_cost: parseMoney(getRowValue(row, "Labor Cost")) || null,
    part_material_cost: parseMoney(getRowValue(row, "Part and Material Cost")) || null,
    profit_amount: parseMoney(getRowValue(row, "Profit")) || null,
    profit_per_hour: parseMoney(getRowValue(row, "Profit / HR")) || null,
    margin_percent: (() => {
      const parsed = parseMoney(getRowValue(row, "Margin"));
      return parsed ? parsed / 100 : null;
    })(),
    refrigerant_lbs: parseNumber(getRowValue(row, "Refrigerant")) || null,
    refrigerant_cost: parseMoney(getRowValue(row, "Refrigerant $")) || null,
    materials_label: getRowValue(row, "Materials") || null,
    material_cost: parseMoney(getRowValue(row, "Material $")) || null,
    pricing_notes: getRowValue(row, "Repair Notes") || null,
  };

  const lineDefs = [];
  for (const partCol of ["Part 1", "Part 2", "Part 3"]) {
    const rawName = row[partCol];
    if (!rawName) continue;
    const cost = parseMoney(row[`${partCol} $`]);
    const resolved = resolveOperationItemName(rawName, cost, "part");
    if (!resolved) continue;
    lineDefs.push({ itemName: resolved, quantity: 1, costAtBuild: roundMoney(cost) });
  }

  const refrigerantQty = parseNumber(getRowValue(row, "Refrigerant"));
  const refrigerantTotalCost = parseMoney(getRowValue(row, "Refrigerant $"));
  if (refrigerantQty > 0 && refrigerantTotalCost > 0) {
    const unitCost = roundMoney(refrigerantTotalCost / refrigerantQty);
    const resolved = resolveOperationItemName(getRowValue(row, "Refrigerant"), unitCost, "refrigerant");
    if (resolved) lineDefs.push({ itemName: resolved, quantity: refrigerantQty, costAtBuild: unitCost });
  }

  const materialName = getRowValue(row, "Materials");
  const materialCost = parseMoney(getRowValue(row, "Material $"));
  if (materialName && materialCost > 0) {
    const resolved = resolveOperationItemName(materialName, materialCost, "materials");
    if (resolved) lineDefs.push({ itemName: resolved, quantity: 1, costAtBuild: roundMoney(materialCost) });
  }

  const laborCost = parseMoney(getRowValue(row, "Labor Cost"));
  const totalTime = parseNumber(getRowValue(row, "Total Time"));
  if (laborCost > 0) {
    const laborUnitCost = 90;
    const quantity = totalTime > 0 ? totalTime : roundMoney(laborCost / laborUnitCost);
    lineDefs.push({
      itemName: "Labor - Hour",
      quantity: quantity > 0 ? quantity : 1,
      costAtBuild: roundMoney(laborUnitCost),
    });
  }

  const profitCost = parseMoney(getRowValue(row, "Profit"));
  if (profitCost > 0) {
    lineDefs.push({ itemName: "Profit", quantity: 1, costAtBuild: roundMoney(profitCost) });
  }

  const block = [];
  block.push("do $$");
  block.push("declare");
  block.push("  v_diagnosis_id uuid;");
  block.push("  v_bundle_id uuid;");
  block.push("begin");
  block.push(
    `  select id into v_diagnosis_id from public.diagnoses where repair_code = public.build_repair_code(${sql(location)}, ${sql(component)}, ${sql(action)}, ${sql(cat1)}, ${sql(cat2)}, ${sql(cat3)}) order by created_at limit 1;`,
  );
  block.push("  if v_diagnosis_id is null then");
  block.push(
    `    insert into public.diagnoses (location, component, action, cat1, cat2, cat3, repair_notes, invoice_description, variable_pricing, one_shot, est_work_hours, historic_price, active) values (${sql(diagnosisPayload.location)}, ${sql(diagnosisPayload.component)}, ${sql(diagnosisPayload.action)}, ${sql(diagnosisPayload.cat1)}, ${sql(diagnosisPayload.cat2)}, ${sql(diagnosisPayload.cat3)}, ${sql(diagnosisPayload.repair_notes)}, ${sql(diagnosisPayload.invoice_description)}, ${sql(diagnosisPayload.variable_pricing)}, ${sql(diagnosisPayload.one_shot)}, ${sql(diagnosisPayload.est_work_hours)}, ${sql(diagnosisPayload.historic_price)}, ${sql(diagnosisPayload.active)}) returning id into v_diagnosis_id;`,
  );
  block.push("  else");
  block.push(
    `    update public.diagnoses set location = ${sql(diagnosisPayload.location)}, component = ${sql(diagnosisPayload.component)}, action = ${sql(diagnosisPayload.action)}, cat1 = ${sql(diagnosisPayload.cat1)}, cat2 = ${sql(diagnosisPayload.cat2)}, cat3 = ${sql(diagnosisPayload.cat3)}, repair_notes = ${sql(diagnosisPayload.repair_notes)}, invoice_description = ${sql(diagnosisPayload.invoice_description)}, variable_pricing = ${sql(diagnosisPayload.variable_pricing)}, one_shot = ${sql(diagnosisPayload.one_shot)}, est_work_hours = ${sql(diagnosisPayload.est_work_hours)}, historic_price = ${sql(diagnosisPayload.historic_price)}, active = ${sql(diagnosisPayload.active)} where id = v_diagnosis_id;`,
  );
  block.push("  end if;");
  block.push("  select id into v_bundle_id from public.repair_bundles where diagnosis_id = v_diagnosis_id order by created_at limit 1;");
  block.push("  if v_bundle_id is null then");
  block.push(
    `    insert into public.repair_bundles (diagnosis_id, name, flat_rate, addon_eligible, addon_description, notes, travel_time_hours, work_time_hours, total_time_hours, labor_cost, part_material_cost, profit_amount, profit_per_hour, margin_percent, refrigerant_lbs, refrigerant_cost, materials_label, material_cost, pricing_notes) values (v_diagnosis_id, ${sql(bundlePayload.name)}, ${sql(bundlePayload.flat_rate)}, false, null, null, ${sql(bundlePayload.travel_time_hours)}, ${sql(bundlePayload.work_time_hours)}, ${sql(bundlePayload.total_time_hours)}, ${sql(bundlePayload.labor_cost)}, ${sql(bundlePayload.part_material_cost)}, ${sql(bundlePayload.profit_amount)}, ${sql(bundlePayload.profit_per_hour)}, ${sql(bundlePayload.margin_percent)}, ${sql(bundlePayload.refrigerant_lbs)}, ${sql(bundlePayload.refrigerant_cost)}, ${sql(bundlePayload.materials_label)}, ${sql(bundlePayload.material_cost)}, ${sql(bundlePayload.pricing_notes)}) returning id into v_bundle_id;`,
  );
  block.push("  else");
  block.push(
    `    update public.repair_bundles set name = ${sql(bundlePayload.name)}, flat_rate = ${sql(bundlePayload.flat_rate)}, travel_time_hours = ${sql(bundlePayload.travel_time_hours)}, work_time_hours = ${sql(bundlePayload.work_time_hours)}, total_time_hours = ${sql(bundlePayload.total_time_hours)}, labor_cost = ${sql(bundlePayload.labor_cost)}, part_material_cost = ${sql(bundlePayload.part_material_cost)}, profit_amount = ${sql(bundlePayload.profit_amount)}, profit_per_hour = ${sql(bundlePayload.profit_per_hour)}, margin_percent = ${sql(bundlePayload.margin_percent)}, refrigerant_lbs = ${sql(bundlePayload.refrigerant_lbs)}, refrigerant_cost = ${sql(bundlePayload.refrigerant_cost)}, materials_label = ${sql(bundlePayload.materials_label)}, material_cost = ${sql(bundlePayload.material_cost)}, pricing_notes = ${sql(bundlePayload.pricing_notes)} where id = v_bundle_id;`,
  );
  block.push("  end if;");
  block.push("  delete from public.repair_bundle_lines where bundle_id = v_bundle_id;");
  for (const line of lineDefs) {
    block.push(
      `  insert into public.repair_bundle_lines (bundle_id, item_id, quantity, cost_at_build) select v_bundle_id, id, ${sql(line.quantity)}, ${sql(line.costAtBuild)} from public.items where lower(name) = lower(${sql(line.itemName)}) order by created_at limit 1;`,
    );
  }
  block.push("end $$;");
  statements.push(block.join("\n"));
}

statements.push("commit;");
await fs.writeFile(OUT_FILE, statements.join("\n\n"));
console.log(OUT_FILE);
console.log(`items=${allItems.size} operations=${operationRows.length}`);
