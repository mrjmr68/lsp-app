-- ============================================================
-- Seed: Diagnosis Catalog
-- Source: Operations - Invoicing - V2.csv
-- 41 diagnosis codes across AHU, CU, FU, SYS locations
-- ============================================================

INSERT INTO public.diagnoses (
  id, location, component, action, repair_code, name,
  repair_notes, invoice_description, historic_price,
  variable_pricing, one_shot, est_work_hours, active
)
VALUES
  ('d82df8b5-4f37-4bd8-b358-762461f7cbf0', 'AHU', 'Capacitor', 'Replace', 'AHU - Capacitor - Replace',
   'AHU - Capacitor - Replace', 'Replace capacitor > test operation', 'Diagnosis: Tested the Air Handler Unit blower assembly and identified a failed run capacitor reading well below rating.
Repair Completed: Discharged and replaced the defective capacitor with a new OEM-rated component. Verified the blower motor is now drawing correct amperage and the system is operating at full airflow capacity.', 233.0,
   false, true, 0.5, true),
  ('a9842414-7017-431f-bde3-310a3c8ff36f', 'AHU', 'Coil', 'Clean', 'AHU - Coil - Clean',
   'AHU - Coil - Clean', 'Vacuum coil > apply no-rinse cleaner > verify airflow', 'Diagnosis: Performed an inspection of the indoor Air Handler Unit and identified significant dust and debris accumulation on the evaporator coil, causing restricted airflow and reduced heat transfer.

Repair Completed: Thoroughly vacuumed the coil face to remove heavy particulate. Applied a professional-grade, no-rinse antimicrobial cleaner to deep-clean the fins and verified that airflow has been restored.', 195.0,
   false, true, 0.5, true),
  ('7e9dee42-6f7a-4e61-a4af-884065a9562d', 'AHU', 'Cond Lines', 'Clear', 'AHU - Cond Lines - Clear',
   'AHU - Cond Lines - Clear', 'Clear condensate drain line - vacuum or air > includes one cut and coupling > verify drainage', 'Diagnosis: Identified a blockage in the primary condensate drain line, causing water backup in the drain pan and triggering the safety float switch to shut down the system.

Repair Completed: Cleared the line and verified proper system drainage and operation.', 165.0,
   false, true, 0.5, true),
  ('ab5d4f37-5fe4-4c05-8a38-4ddab2e2bb5f', 'AHU', 'Control Board', 'Replace', 'AHU - Control Board - Replace',
   'AHU - Control Board - Replace', 'Replace blower control board > repair damaged wiring > test operation', 'Diagnosis: Inspected indoor Air Handler Unit and identified a failed integrated control board with visible burn marks; confirmed board was failing to send voltage to the blower motor.

Repair Completed: Disconnected electrical supply and replaced the faulty OEM board. Verified all wire terminations, restored power, and confirmed the system cycles correctly through all stages.', 456.0,
   false, true, 1.0, true),
  ('7cf9b1ff-8f37-4e9a-b67a-7e881a00b67c', 'AHU', 'Drain Pan', 'Replace', 'AHU - Drain Pan - Replace',
   'AHU - Drain Pan - Replace', 'Remove existing drain pan > install new drain pan > verify drainage > test operation', 'Diagnosis: Inspected the indoor Air Handler Unit and identified a cracked/corroded primary drain pan that was leaking moisture into the cabinet and bypassing the condensate line.

Repair Completed: Disconnected the drain assembly and removed the compromised pan. Installed a new OEM-rated drain pan, re-established all plumbing connections, and verified proper drainage.', 850.0,
   false, false, 3.0, true),
  ('378c0e5b-4fd1-4043-a13f-1007a772e612', 'AHU', 'Evap Coil', 'Replace', 'AHU - Evap Coil - Replace',
   'AHU - Evap Coil - Replace', 'Recover refrigerant > remove evaporator coil > install new coil > pressure test > evacuate system > recharge - pricing based on $350 coil adjust as needed', 'Diagnosis: Isolated a non-repairable refrigerant leak within the indoor evaporator coil using electronic leak detection; confirmed the coil integrity was compromised and causing system-wide cooling failure.

Repair Completed: Recovered all refrigerant to EPA standards and replaced the faulty coil with a new OEM assembly. Successfully performed a high-pressure nitrogen test, evacuated the system to a deep vacuum (below 500 microns), and recharged with new refrigerant to factory specifications.', 1675.0,
   true, false, 4.0, true),
  ('911836b0-7db9-491c-88de-6dc2875f3423', 'AHU', 'Limit / Sequencer', 'Replace', 'AHU - Limit / Sequencer - Replace',
   'AHU - Limit / Sequencer - Replace', 'Replace limit switch or sequencer > verify safe operation', 'Diagnosis: Identified a faulty limit switch or heat sequencer failing to engage/disengage the electric heat strips correctly.

Repair Completed: Replaced the defective component and verified all safety limits and temperature rises are within manufacturer specifications.', 211.0,
   false, true, 1.0, true),
  ('27da5e6f-8b9a-412f-ab4a-5bbe46d73cd3', 'AHU', 'Motor', 'Replace', 'AHU - Motor - Replace - Forward',
   'AHU - Motor - Replace - Forward', 'Replace accessible blower motor > secure wiring > test operation', 'Diagnosis: Confirmed a failed blower motor (accessible) with an open winding or seized bearing preventing air circulation.

Repair Completed: Replaced the motor and secured all internal wiring; verified proper rotation and system airflow during a full cycle test.', 673.0,
   false, false, 1.5, true),
  ('da91903f-7d30-49d2-9d82-3933c545ceea', 'AHU', 'Motor', 'Replace', 'AHU - Motor - Replace - Transverse',
   'AHU - Motor - Replace - Transverse', 'Remove blower assembly > replace motor in non-removable housing > reassemble > test operation', 'Diagnosis: Identified a failed blower motor located within a non-removable housing, requiring full assembly disassembly.

Repair Completed: Removed the blower assembly, replaced the transverse motor, and reassembled the unit; verified smooth operation and correct amp draws.', 922.0,
   false, false, 3.0, true),
  ('896746bc-fe1c-476f-988e-089b7875e660', 'CU', 'Capacitor', 'Replace', 'CU - Capacitor - Replace',
   'CU - Capacitor - Replace', 'Replace capacitor > test operation', 'Diagnosis: Found a failed dual-run capacitor in the outdoor condenser, preventing the compressor or fan motor from starting.

Repair Completed: Replaced the faulty capacitor with a new capacitor matching system requirements and verified that all outdoor components are starting and running correctly.', 250.0,
   false, true, 0.5, true),
  ('2ff46c7b-64c0-4f71-a20e-0622e692a4f7', 'CU', 'Compressor', 'Replace', 'CU - Compressor - Replace',
   'CU - Compressor - Replace', 'Recover refrigerant > remove failed compressor > install new compressor > replace filter/drier > pressure test > evacuate system > recharge', 'Diagnosis: Diagnosed a failed compressor with an internal mechanical failure or electrical short to ground.

Repair Completed: Recovered refrigerant, replaced the compressor and liquid line filter/drier, pressure tested, evacuated, and recharged the system to factory specs.', 2023.0,
   true, false, 6.0, true),
  ('68c762b3-278c-4eb5-977b-cdf293703984', 'CU', 'Condenser Coil', 'Replace', 'CU - Condenser Coil - Replace',
   'CU - Condenser Coil - Replace', 'Recover refrigerant > remove evaporator coil > install new coil > pressure test > evacuate system > recharge - pricing based on $450 coil adjust as needed', 'Diagnosis: Identified a major refrigerant leak at the condenser coil.

Repair Completed: Recovered refrigerant, replaced the condenser coil, performed a nitrogen leak test, evacuated the system, and restored the full refrigerant charge.', 1520.0,
   true, false, 6.0, true),
  ('87c6ce5d-8192-46ef-92b5-5f5a24898e5b', 'CU', 'Contactor', 'Replace', 'CU - Contactor - Replace',
   'CU - Contactor - Replace', 'Replace contactor > verify operation', 'Diagnosis: Found pitted or welded contactor points causing intermittent operation or a constant "stuck on" condition for the outdoor unit.

Repair Completed: Replaced the defective contactor and verified proper voltage delivery to the compressor and fan motor.', 332.0,
   false, true, 1.0, true),
  ('6fc70c8a-6caf-4966-9180-0b5b4e5e8b23', 'CU', 'Control Board', 'Replace', 'CU - Control Board - Replace',
   'CU - Control Board - Replace', 'Replace control board > verify wiring > test operation', 'Diagnosis: Confirmed the outdoor defrost or logic board was faulty, preventing the condenser from cycling or defrosting correctly.

Repair Completed: Installed a new OEM control board, verified all wiring terminations, and tested the unit''s sequence of operation.', 342.0,
   false, true, 0.5, true),
  ('f0da0c5d-981d-4694-bec2-49eb743d3265', 'CU', 'Control Board', 'Reset', 'CU - Control Board - Reset',
   'CU - Control Board - Reset', 'Reset control board > verify operation', 'Diagnosis: Found the outdoor unit locked out due to a temporary fault or power surge.

Repair Completed: Performed a hard reset of the control board and monitored system operation to ensure the fault did not immediately reoccur.', 195.0,
   false, true, 0.5, true),
  ('510b0fe8-d2ae-45e9-bd4c-e19165d9fa9a', 'CU', 'Motor', 'Replace', 'CU - Motor - Replace',
   'CU - Motor - Replace', 'Replace condenser fan motor > secure wiring > test operation', 'Diagnosis: Confirmed the condenser fan motor had failed, leading to high system pressures and thermal cutout.

Repair Completed: Replaced the fan motor, secured the wiring, and verified proper heat rejection from the outdoor coil.', 275.0,
   false, true, 0.75, true),
  ('e44ba559-e6b0-475d-8235-476e6c22a017', 'CU', 'Power', 'Cross Wired', 'CU - Power - Cross Wired',
   'CU - Power - Cross Wired', 'Disconnect all power > Adjust and reconnect whips', 'Diagnosis: Confirmed condensing unit was wired to the incorrect apartment electrical circuit; identified cross-wired whips at the outdoor units.

Repair Completed: Swapped the electrical whips/connections between the units to align with the correct apartment panels. Verified proper power supply and thermostat communication for both systems.', NULL,
   false, true, 2.0, true),
  ('93dc2bec-6a35-48c0-b7cd-f0317fe02d51', 'CU', 'Pres Switch', 'Replace', 'CU - Pres Switch - Replace',
   'CU - Pres Switch - Replace', 'Recover refrigerant > replace pressure switch > pressure test > evacuate system > recharge', 'Diagnosis: Identified a faulty high or low-pressure safety switch giving false readings and locking out the system.

Repair Completed: Recovered refrigerant, replaced the defective pressure switch, pressure tested, evacuated, and recharged the system.', 865.0,
   false, false, 2.5, true),
  ('73a6a956-e4d4-4163-ae80-de4263b96441', 'CU', 'Rev Valve', 'Replace', 'CU - Rev Valve - Replace',
   'CU - Rev Valve - Replace', 'Recover refrigerant > replace reversing valve > pressure test > evacuate system > recharge', 'Diagnosis: Found the heat pump reversing valve stuck or bypassing internally, preventing the system from switching modes.

Repair Completed: Recovered refrigerant, brazed in a new reversing valve, pressure tested, evacuated, and recharged the system to specifications.', 918.0,
   false, false, 4.5, true),
  ('f8c5648d-356a-49e6-8ff5-1e4824b4b7c3', 'CU', 'TXV', 'Replace', 'CU - TXV - Replace',
   'CU - TXV - Replace', 'Recover refrigerant > replace TXV > pressure test > evacuate system > recharge', 'Diagnosis: Identified a failed Thermal Expansion Valve (TXV) causing a refrigerant restriction and poor cooling performance.

Repair Completed: Recovered refrigerant, replaced the TXV and filter/drier, pressure tested, evacuated, and recharged the system to ensure proper superheat/subcooling.', 828.0,
   false, true, 3.0, true),
  ('b553ad53-a7d8-46ec-b4bb-0055e40fb3a9', 'FU', 'Draft Inducer', 'Replace', 'FU - Draft Inducer - Replace',
   'FU - Draft Inducer - Replace', 'Remove blower assembly > install new assembly and motor > test operation', 'Diagnosis: Identified a failed draft inducer motor assembly; confirmed the motor was either seized, had an open internal winding, or the centrifugal wheel was damaged, preventing the pressure switch from closing.

Repair Completed: Removed the defective inducer assembly and cleaned the mounting surface. Installed a new OEM-rated draft induction motor and housing, verified the gasket seal, and confirmed proper venting and pressure switch engagement during the ignition sequence.', 650.0,
   false, false, 1.5, true),
  ('73cbabd3-c8fb-4b0b-9557-5d709461ff57', 'FU', 'Gas Valve', 'Replace', 'FU - Gas Valve - Replace',
   'FU - Gas Valve - Replace', 'Shut off gas > remove gas valve > install new gas valve > leak check > verify manifold pressure > test operation', 'Diagnosis: Confirmed the gas valve was failing to open or maintain proper manifold pressure, preventing burner ignition.

Repair Completed: Replaced the gas valve, performed a gas leak check, adjusted manifold pressure to factory specs, and verified safe ignition.', 860.0,
   false, false, 2.0, true),
  ('f2e7d0e7-1045-4918-932e-805e45283f04', 'SYS', 'Attic/Crawl AHU', 'Change Out', 'SYS - Attic/Crawl AHU - Change Out',
   'SYS - Attic/Crawl AHU - Change Out', 'Remove existing system > install new AHU > reconnect duct > reconnect electrical > reconnect drain > reconnect refrigerant lines > test operation', 'Diagnosis: Conducted a complete evaluation and determined that the existing system has reached the end of its functional lifespan, exhibiting multiple component failures and overall inefficiency.

Repair Completed: System Change Out
> Decommissioned and removed the existing indoor and outdoor units.
> Installed a new AHRI matched system.
> Conduct system pressure test and evacuated system to below 500 microns.
> Flushed refrigerant lines, connect primary and secondary drainage systems, and complete high and low-voltage electrical connections.
> Performed a comprehensive startup, verified refrigerant subcooling/superheat, and confirmed the system is operating at peak factory performance.', 5800.0,
   true, false, 16.0, true),
  ('2dfda2e3-bbcf-402b-8740-242ce8e0de6e', 'SYS', 'Ducts', 'Reset', 'SYS - Ducts - Reset - Fire Damper',
   'SYS - Ducts - Reset - Fire Damper', 'Replace fusible link > verify damper operation', 'Diagnosis: Identified a tripped fire damper in the ductwork due to a failed fusible link, blocking airflow.

Repair Completed: Replaced the fusible link, reset the damper to the open position, and verified proper airflow through the affected zone.', 257.0,
   false, true, 1.0, true),
  ('1d3a06dd-1ef1-4e7d-ba40-74b91f01b3df', 'SYS', 'LV', 'Repair', 'SYS - LV - Repair - Heat Strip',
   'SYS - LV - Repair - Heat Strip', 'Repair low voltage wiring to heat strips > verify operation', 'Diagnosis: Found damaged or loose low-voltage control wiring leading to the electric heat strip assembly.

Repair Completed: Repaired the control wiring and verified that the heat strips engage and disengage correctly on demand.', 250.0,
   false, true, 0.5, true),
  ('f8737076-e61f-4cb8-b254-c79b77dbeb17', 'SYS', 'LV', 'Repair', 'SYS - LV - Repair - Rev Valve',
   'SYS - LV - Repair - Rev Valve', 'Repair low voltage wiring to reversing valve > verify operation', 'Diagnosis: Identified a wiring fault in the low-voltage circuit for the reversing valve solenoid.

Repair Completed: Repaired the compromised wiring and verified the heat pump now successfully switches between heating and cooling modes.', 195.0,
   false, true, 0.5, true),
  ('2cc6c649-a8e4-4b5c-b838-bdb0388471e3', 'SYS', 'LV', 'Repair', 'SYS - LV - Repair - Short',
   'SYS - LV - Repair - Short', 'Trace low voltage short > isolate fault > repair wiring > verify operation', 'Diagnosis: Located a low-voltage short circuit that was causing the transformer to trip or fuses to blow.

Repair Completed: Traced and isolated the wiring fault, repaired the shorted section, and verified stable low-voltage operation.', 229.0,
   false, true, 1.0, true),
  ('69dd5514-3221-49d5-ba7f-b3ad201ffb94', 'SYS', 'LV', 'Repair', 'SYS - LV - Repair - Thermostat',
   'SYS - LV - Repair - Thermostat', 'Repair low voltage wiring at thermostat > verify operation', 'Diagnosis: Found a break or poor connection in the low-voltage thermostat wire between the Thermostat and the equipment.

Repair Completed: Repaired the thermostat wiring and verified all signals are reaching the control boards correctly.', 195.0,
   false, true, 0.5, true),
  ('5f21a4b9-a140-4907-b317-0649a78a544b', 'SYS', 'MIN', 'None', 'SYS - MIN - None',
   'SYS - MIN - None', 'No issues found - system operating properly at time of inspection', 'Diagnosis: Conducted a full system inspection and performance test as requested.

Repair Completed: No mechanical or electrical issues were found; the system is operating within manufacturer specifications at this time.', 195.0,
   false, true, 0.25, true),
  ('4ce329a2-cdcb-4038-a87a-d7499e896d46', 'SYS', 'MIN', 'Reser Power', 'SYS - MIN - Reser Power - AHU',
   'SYS - MIN - Reser Power - AHU', 'Reset breaker or restore power to AHU - non-HVAC issue > verify operation', 'Diagnosis: Found the indoor unit was non-functional due to a tripped breaker or disconnected power source.

Repair Completed: Reset the circuit breaker and verified the Air Handler is receiving proper voltage and operating correctly.', 195.0,
   false, true, 0.25, true),
  ('76e7df69-c3f2-46f5-850d-bbe8c4e2ee40', 'SYS', 'MIN', 'Reset', 'SYS - MIN - Reset - Fire Stat',
   'SYS - MIN - Reset - Fire Stat', 'Reset fire stat > verify operation > confirm temperature limits', 'Diagnosis: Identified that the fire stat had tripped, cutting power to the HVAC system.

Repair Completed: Reset the fire stat and verified that return air temperatures are within safe limits for normal operation.', 195.0,
   false, true, 0.25, true),
  ('0095f2ac-f4b9-4aa4-8bc9-028d694de56f', 'SYS', 'MIN', 'Reset Power', 'SYS - MIN - Reset Power - CU',
   'SYS - MIN - Reset Power - CU', 'Reset breaker or restore power to condenser - non-HVAC issue > verify operation', 'Diagnosis: Identified that the outdoor condenser was non-functional due to a tripped breaker or disconnected service switch.

Repair Completed: Restored power to the unit and verified the compressor and fan are cycling correctly.', 195.0,
   false, true, 0.25, true),
  ('b199b1d4-a5b6-48b2-9a7d-41d2b73521b6', 'SYS', 'MIN', 'Set', 'SYS - MIN - Set - Thermostat',
   'SYS - MIN - Set - Thermostat', 'Thermostat set incorrectly or off - adjust settings > verify operation', 'Diagnosis: System was found to be non-operational due to incorrect thermostat settings or user-programming errors.

Repair Completed: Adjusted thermostat settings to the correct mode and temperature; educated the customer on proper thermostat operation.', 195.0,
   false, true, 0.25, true),
  ('8b42a50b-a103-4502-aa2f-1b4168e43892', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Leak - Easy',
   'SYS - REF - Repair - Leak - Easy', 'Schrader core or service valve leak - repair or replace > evacuate system > recharge', 'Diagnosis: Found a minor refrigerant leak at a Schrader core or service valve cap.

Repair Completed: Replaced the faulty core/seal and restored the refrigerant charge to factory levels.', 359.0,
   false, true, 1.0, true),
  ('4cc25a31-0311-463f-882e-d78cfe0486d1', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Leak - In Wall',
   'SYS - REF - Repair - Leak - In Wall', 'In-wall leak - locate leak > recover refrigerant > braze repair > pressure test > evacuate system > recharge', 'Diagnosis: Located a refrigerant leak within the line set inside a wall cavity.

Repair Completed: Recovered refrigerant, performed a braze repair at the leak site, pressure tested, evacuated, and recharged the system.', 1200.0,
   true, false, 6.0, true),
  ('bef89fbd-c203-4d48-a904-b2c20bb34483', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Leak - NLF',
   'SYS - REF - Repair - Leak - NLF', 'No leak found - recharge system > monitor operation', 'Diagnosis: System was low on charge but no active leak was found after an initial search.

Repair Completed: Added refrigerant to bring the system to factory specs - monitor for future leaks.', 276.0,
   false, true, 0.75, true),
  ('140adab8-226b-46d8-830c-a9704b3f6094', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Leak - Pump Down',
   'SYS - REF - Repair - Leak - Pump Down', 'Pump down system > braze repair > pressure test > evacuate system > recharge', 'Diagnosis: Identified a repairable leak in the high-side or outdoor section of the system.

Repair Completed: Pumped down the refrigerant, performed a braze repair, pressure tested the line, evacuated, and restored full operation.', 894.0,
   false, true, 3.0, true),
  ('77f9d93f-494c-4ddf-a922-914f9fc42aac', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Leak - Recover',
   'SYS - REF - Repair - Leak - Recover', 'Recover refrigerant > braze repair > pressure test > evacuate system > recharge', 'Diagnosis: Located a refrigerant leak requiring a full system recovery for safe repair.

Repair Completed: Recovered refrigerant, brazed the leak, performed a nitrogen pressure test, evacuated to a deep vacuum, and recharged the system.', 950.0,
   false, false, 4.0, true),
  ('c6107763-7183-4cce-b7ef-577364cd39f0', 'SYS', 'REF', 'Repair', 'SYS - REF - Repair - Restriction',
   'SYS - REF - Repair - Restriction', 'Pump down system > clean metering device > replace filter/drier > evacuate system > recharge', 'Diagnosis: Identified a restriction in the refrigerant circuit, likely at the metering device or filter/drier.

Repair Completed: Pumped down the system, cleaned/replaced the metering device and filter/drier, evacuated, and verified proper flow.', 360.0,
   true, false, 2.0, true),
  ('a2f9c970-de12-4456-92c9-6f6b48049743', 'SYS', 'Thermostat', 'Replace', 'SYS - Thermostat - Replace',
   'SYS - Thermostat - Replace', 'Remove thermostat > install new thermostat > program > verify operation', 'Diagnosis: Confirmed the existing thermostat was faulty or unresponsive to user inputs.

Repair Completed: Installed and programmed a new thermostat; verified that the system responds correctly to calls for fan, heat, and cool.', 335.0,
   false, true, 0.75, true),
  ('7dd37887-3746-42c7-bf70-75565797e0f5', 'AHU', 'Coil', 'Defrost & Clean', 'AHU - Coil - Defrost & Clean',
   'AHU - Coil - Defrost & Clean', '', NULL, NULL,
   false, false, NULL, true);
