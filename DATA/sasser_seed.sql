-- ============================================================
-- Seed: Sasser Companies — Customer + Locations
-- NOTE: Harrisburg location has a bad address ("I'm") — fix after import.
-- ============================================================

-- Step 1: Insert the customer
INSERT INTO public.customers (id, name, type, bill_to_parent)
VALUES ('b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Sasser Companies', 'commercial', false);

-- Step 2: Insert all 43 locations
INSERT INTO public.locations (id, customer_id, name, street_address, city, state, zip)
VALUES
  ('e3676d93-8b51-4da7-8acd-4fded7f02e07', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Aberdeen', '1800 N Sandhills Blvd', 'Aberdeen', 'NC', '28315'),
  ('e326fd42-43a7-4fce-9101-c42046e91f63', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Asheville', '160 Hendersonville Rd', 'Asheville', 'NC', '28803'),
  ('d19cf639-f10c-4d31-a96c-62e6178ab3c2', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Boone', '178 Hwy 105 Ext, Suite 101', 'Boone', 'NC', '28607'),
  ('dbb76754-9013-42ec-8643-2f4ec0d88ca1', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Burlington', '104 Huffman Mill Rd', 'Burlington', 'NC', '27215'),
  ('bd1db748-b027-4cb8-926a-bd5e3a681439', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Ten Ten Road', '3420 Ten Ten Rd, Suite 318', 'Cary', 'NC', '27518'),
  ('e6e2d4ee-9d4b-43a4-9135-fb9965cc326b', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Cornerstone Drive', '100 Cornerstone Dr', 'Cary', 'NC', '27519'),
  ('904c1201-1287-41cf-a545-6f1c6c153061', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Wilkinson Boulevard', '3250 Wilkinson Blvd, Suite I', 'Charlotte', 'NC', '28208'),
  ('89ca92b5-bb89-4472-afc7-a579ec6557f7', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'West Mallard Creek Church Road', '2728 W Mallard Creek Church Rd, Suite 300', 'Charlotte', 'NC', '28262'),
  ('3f5c159b-17ef-4fe6-96d8-d456d59ce1c7', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Clayton', '11491 US Hwy 70 W', 'Clayton', 'NC', '27520'),
  ('2d2684fb-5036-4083-a61b-9c137086954b', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Concord', '391 George W Liles Pkwy NW', 'Concord', 'NC', '28027'),
  ('b3a59aeb-cd1f-4a21-9590-0584c236cd8f', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Durham', '7010 NC Highway 751', 'Durham', 'NC', '27707'),
  ('0475ac53-5699-459e-a903-5f451f0c8cc2', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Hope Mills', '3007 Town Center Dr, Suite 100-101', 'Fayetteville', 'NC', '28306'),
  ('c105846a-4bc5-44ca-8678-1ecbc06210d5', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Francam Drive', '150 Francam Drive, Suite 120', 'Fayetteville', 'NC', '28311'),
  ('e3acdc52-d19b-41e3-8c10-6f910175de62', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Fuquay-Varina', '1418 N Main St', 'Fuquay-Varina', 'NC', '27526'),
  ('d69e4fb1-ebc9-49be-89ec-740dc2891d15', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Garner - Hwy 42 W', '5156 NC Hwy 42 W', 'Garner', 'NC', '27529'),
  ('1880166c-1f63-46c5-bc8b-e9dc49087647', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Garner - US 70 Hwy', '220 US 70 Hwy', 'Garner', 'NC', '27529'),
  ('a7dbab37-f0c3-47e2-aca2-361b20d17c46', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Goldsboro', '212 N Spence Ave', 'Goldsboro', 'NC', '27534'),
  ('cbf32bb9-22e1-4230-8d91-457170b4e9d7', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Battleground Avenue', '3215 Battleground Ave', 'Greensboro', 'NC', '27408'),
  ('224128cd-8e39-4341-af27-6483d44eef6d', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Greenville', '315 Greenville Blvd SE, Suite 100', 'Greenville', 'NC', '27858'),
  ('835952de-30e8-4260-9985-6427a6d1d451', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Harrisburg', NULL, 'Harrisburg', 'NC', '28075'),
  ('5d033e1f-c519-4e54-8ab1-123f330dc676', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Henderson', '903 S Beckford Dr', 'Henderson', 'NC', '27536'),
  ('86c19b3b-747e-456a-b6c7-4a4e73f6e1b3', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Hendersonville', '825 Spartanburg Hwy, Suite 17', 'Hendersonville', 'NC', '28792'),
  ('f5cc16be-8d6c-4655-8e7c-dd41d075ffef', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Hickory', '2280 Hwy 70 SE', 'Hickory', 'NC', '28602'),
  ('a6b40cd9-48a8-498a-88df-76a361625627', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Skeet Club Road', '1589 Skeet Club Rd, Suite 155', 'High Point', 'NC', '27265'),
  ('febc50a2-4f86-4eb4-9dd2-9653c710203d', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Kinston', '2908 N Heritage St', 'Kinston', 'NC', '28501'),
  ('001e7c45-adc8-4f8d-99d9-e8467e495ab6', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Leland', '202 Village Rd NE', 'Leland', 'NC', '28451'),
  ('28881568-a47b-42ea-bff5-83731124bf0f', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Lenoir', '825 Blowing Rock Blvd', 'Lenoir', 'NC', '28645'),
  ('d8df8924-a9cc-4a60-baab-4b3c393f8e85', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Lumberton', '5080 Kahn Dr, Suite 120', 'Lumberton', 'NC', '28358'),
  ('7b2be803-7bcc-4ce4-9e19-9daa4e965e10', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Morehead City', '3722 Bridges St, STE A', 'Morehead City', 'NC', '28557'),
  ('0592ee1a-abc3-4405-8f38-4cd459a41895', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Raleigh - Downtown', '501 N Harrington St', 'Raleigh', 'NC', '27603'),
  ('4e762113-5a3d-48a3-a77a-2fc6f49e6f31', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Millbrook Road', '1311 E Millbrook Rd', 'Raleigh', 'NC', '27609'),
  ('1b664b25-3454-476b-9079-17388703c281', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Creedmoor Road', '6500 Creedmoor Rd, Suite 110', 'Raleigh', 'NC', '27613'),
  ('aa7e30f5-9dad-4030-95a3-ee07cb58bca2', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Roanoke Rapids', '1261 Julian Allsbrook Hwy', 'Roanoke Rapids', 'NC', '27870'),
  ('65c5a96f-768c-44d6-80e5-789642e1f2e1', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Rockingham', '1262 E Broad Ave', 'Rockingham', 'NC', '28379'),
  ('8919bd02-48b3-4c27-9369-1ae2858d4bad', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Sunset Avenue', '2001 Sunset Ave', 'Rocky Mount', 'NC', '27804'),
  ('7bedc7cb-8a4e-4ee3-a5ed-bc32f88b5d5a', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Roxboro', '910 N Madison Blvd, Suite B', 'Roxboro', 'NC', '27573'),
  ('be4df994-f144-4eb2-a15b-8d401c048b08', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Salisbury', '1361 Klumac Rd', 'Salisbury', 'NC', '28147'),
  ('faaea06a-edbc-4f90-b860-a359c8d5757c', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Sanford', '724 S Horner Blvd', 'Sanford', 'NC', '27330'),
  ('9d0c754b-ffd3-4e7a-b590-4df25641715d', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Wilkesboro', '1903 Addison Ave', 'Wilkesboro', 'NC', '28697'),
  ('49c5922d-479f-4115-a2d0-545e80f55b06', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Wilmington', '5214 Market Street', 'Wilmington', 'NC', '28405'),
  ('3597f6ac-5166-4b53-9a1a-194dbab2436e', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Wilson', '2503-B Forest Hills Rd', 'Wilson', 'NC', '27893'),
  ('d09811d3-b3bb-474f-943c-e1b71100bd38', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Stratford Road', '310 S Stratford Rd, Suite 120', 'Winston-Salem', 'NC', '27103'),
  ('1da52327-c93e-4838-9fee-b2c9f90f4243', 'b6fc73b1-0c8b-470f-9ba1-8c8dbcee5560', 'Zebulon', '817 E Gannon Ave, Suite 104', 'Zebulon', 'NC', '27597');
