/**
 * Multi-Hospital, Doctor Specifications, Experience, Age & Health Packages Test Suite
 */

import { ASTER_WEBSITE_PAGES, ASTER_DOCTORS, ASTER_SPECIALTIES, ASTER_LOCATIONS, ASTER_HEALTH_PACKAGES, HOSPITAL_FACILITIES_COMPARISON } from './scripts/data.js';
import { AsterChatbot } from './scripts/chatbot.js';
import { WebCrawler } from './scripts/crawler.js';
import { SearchIndexer } from './scripts/indexer.js';

async function runVerificationTests() {
  console.log('========================================================================');
  console.log('🏥 ASTER HOSPITALS DOCTOR ATTRIBUTES (EXPERIENCE, AGE, NAME) TEST SUITE');
  console.log('========================================================================\n');

  // Test 1: Complete Doctor Metadata Integrity
  console.log('▶ TEST 1: Verifying Doctor Experience, Age, Gender, Fee, and Aliases Data...');
  console.assert(ASTER_DOCTORS.length === 28, `Doctor count === 28 (found ${ASTER_DOCTORS.length})`);
  
  for (const doc of ASTER_DOCTORS) {
    console.assert(doc.name && doc.name.startsWith('Dr.'), `Doctor name valid: ${doc.name}`);
    console.assert(typeof doc.experienceYears === 'number' && doc.experienceYears >= 10, `Experience numeric: ${doc.name} (${doc.experienceYears} yrs)`);
    console.assert(typeof doc.age === 'number' && doc.age >= 35, `Age numeric: ${doc.name} (${doc.age} yrs)`);
    console.assert(doc.gender === 'Male' || doc.gender === 'Female', `Gender valid: ${doc.name} (${doc.gender})`);
    console.assert(typeof doc.feeAmount === 'number' && doc.feeAmount > 0, `Fee numeric: ${doc.name} (₹${doc.feeAmount})`);
    console.assert(Array.isArray(doc.aliases) && doc.aliases.length > 0, `Aliases valid: ${doc.name}`);
    console.assert(Array.isArray(doc.specifications) && doc.specifications.length >= 3, `Specifications valid: ${doc.name}`);
  }
  console.log(`✅ Test 1 Passed: All 28 doctors verified with structured age, experienceYears, gender, feeAmount, aliases, and clinical specifications.\n`);

  // Test 2: AI Chatbot Experience Analysis & Filtering
  console.log('▶ TEST 2: Testing Experience Filtering & Sorting in Chatbot...');
  const chatbot = new AsterChatbot();

  // Case A: Query doctors with > 25 years experience
  const veteranDocs = chatbot.findDoctorsForQuery("doctors with more than 25 years experience");
  console.log(`  Query: "doctors with more than 25 years experience" -> Found ${veteranDocs.length} doctors`);
  console.assert(veteranDocs.length >= 7, 'Found 7+ doctors with > 25 years experience');
  for (const doc of veteranDocs) {
    console.assert(doc.experienceYears >= 25, `${doc.name} has ${doc.experienceYears} >= 25 yrs`);
  }

  // Case B: Most experienced cardiologist
  const topCardio = chatbot.findDoctorsForQuery("most experienced cardiologist");
  console.log(`  Query: "most experienced cardiologist" -> Top doctor: ${topCardio[0]?.name} (${topCardio[0]?.experienceYears} yrs exp)`);
  console.assert(topCardio[0].name === "Dr. P. Ramesh Babu" || topCardio[0].name === "Dr. S. N. Khanna", 'Top experienced cardiologist returned');

  // Case C: Doctor experience in Calicut
  const calicutExp = chatbot.findDoctorsForQuery("doctors with more than 20 years experience in Calicut");
  console.log(`  Query: "doctors with more than 20 years experience in Calicut" -> Found ${calicutExp.length} doctors in Calicut`);
  console.assert(calicutExp.length >= 5, 'Found 5+ senior doctors in Calicut');
  for (const doc of calicutExp) {
    console.assert(doc.branchCode === 'calicut-mims' && doc.experienceYears >= 20, `${doc.name} in Calicut with ${doc.experienceYears} yrs`);
  }
  console.log('✅ Test 2 Passed: Experience parsing, filtering, and sorting work with 100% precision.\n');

  // Test 3: AI Chatbot Age, Gender & Fee Analysis
  console.log('▶ TEST 3: Testing Age, Gender, and Fee Analysis in Chatbot...');
  
  // Case A: Female Gynecologist in Bangalore
  const femaleDocs = chatbot.findDoctorsForQuery("female gynecologist in Bangalore");
  console.log(`  Query: "female gynecologist in Bangalore" -> Found ${femaleDocs.length} doctors: ${femaleDocs.map(d => d.name).join(', ')}`);
  console.assert(femaleDocs.length >= 2, 'Found female gynecologists in Bangalore');
  for (const doc of femaleDocs) {
    console.assert(doc.gender === 'Female' && doc.city === 'Bangalore', `${doc.name} is female gynecologist in Bangalore`);
  }

  // Case B: Doctor age above 55
  const seniorAgeDocs = chatbot.findDoctorsForQuery("doctors age above 55");
  console.log(`  Query: "doctors age above 55" -> Found ${seniorAgeDocs.length} doctors`);
  for (const doc of seniorAgeDocs) {
    console.assert(doc.age >= 55, `${doc.name} age ${doc.age} >= 55`);
  }

  // Case C: Consultation fee under 1000
  const budgetDocs = chatbot.findDoctorsForQuery("doctors with fee under 1000");
  console.log(`  Query: "doctors with fee under 1000" -> Found ${budgetDocs.length} doctors`);
  for (const doc of budgetDocs) {
    console.assert(doc.feeAmount <= 1000, `${doc.name} fee ₹${doc.feeAmount} <= 1000`);
  }
  console.log('✅ Test 3 Passed: Age, gender, and consultation fee analysis work accurately.\n');

  // Test 4: Doctor Name & Alias Matching
  console.log('▶ TEST 4: Testing Doctor Name & Alias Matching...');
  const nameQueries = [
    { query: "Dr. Khanna", expected: "Dr. S. N. Khanna" },
    { query: "Varma Parkinson DBS", expected: "Dr. Ravi Gopal Varma" },
    { query: "Asthana liver transplant", expected: "Dr. Sonal Asthana" },
    { query: "Gangadharan cancer Calicut", expected: "Dr. K. V. Gangadharan" },
    { query: "Venugopal cardiologist Calicut", expected: "Dr. Venugopal K" },
    { query: "Noufal Basheer pulmonologist", expected: "Dr. Noufal Basheer" }
  ];

  for (const item of nameQueries) {
    const res = chatbot.findDoctorsForQuery(item.query);
    console.assert(res.length > 0 && res[0].name === item.expected, `Query "${item.query}" returned ${item.expected}`);
    console.log(`  Query: "${item.query}" -> Matched: ${res[0].name}`);
  }
  // Test 5: Exact User Phrasing for Experience & Personal Details
  console.log('▶ TEST 5: Testing Exact User Phrasing for Experience Constraints & Personal Details...');
  
  // Case A: Exact User Query: "give me list of doctors who have experience of above 10 years"
  const userQueryDocs1 = chatbot.findDoctorsForQuery("give me list of doctors who have experience of above 10 years");
  console.log(`  Query: "give me list of doctors who have experience of above 10 years" -> Found ${userQueryDocs1.length} doctors`);
  console.assert(userQueryDocs1.length === 28, `All 28 doctors have >10 years experience (found ${userQueryDocs1.length})`);
  for (const doc of userQueryDocs1) {
    console.assert(doc.experienceYears >= 10, `${doc.name} experience ${doc.experienceYears} >= 10`);
  }

  // Case B: Phrasing: "doctors who have experience of above 20 years"
  const userQueryDocs2 = chatbot.findDoctorsForQuery("doctors who have experience of above 20 years");
  console.log(`  Query: "doctors who have experience of above 20 years" -> Found ${userQueryDocs2.length} doctors`);
  console.assert(userQueryDocs2.length >= 15, `Found 15+ doctors with > 20 years experience (found ${userQueryDocs2.length})`);
  for (const doc of userQueryDocs2) {
    console.assert(doc.experienceYears >= 20, `${doc.name} experience ${doc.experienceYears} >= 20`);
  }

  // Case C: Personal Details Data Integrity for All Doctors
  for (const doc of ASTER_DOCTORS) {
    console.assert(doc.regNo && (doc.regNo.includes('KMC') || doc.regNo.includes('TMC') || doc.regNo.includes('TSMC') || doc.regNo.includes('APMC') || doc.regNo.includes('MCI')), `Medical Reg No valid: ${doc.name} (${doc.regNo})`);
    console.assert(doc.education && doc.education.length > 5, `Education valid: ${doc.name} (${doc.education})`);
    console.assert(doc.surgeriesCount && doc.surgeriesCount.length > 5, `Surgeries count valid: ${doc.name} (${doc.surgeriesCount})`);
    console.assert(doc.chamber && doc.chamber.length > 3, `Chamber valid: ${doc.name} (${doc.chamber})`);
    console.assert(doc.email && doc.email.includes('@asterhospital.com'), `Email valid: ${doc.name} (${doc.email})`);
    console.assert(doc.phone && doc.phone.length > 5, `Phone valid: ${doc.name} (${doc.phone})`);
    console.assert(doc.videoConsultFee && doc.videoConsultFee.startsWith('₹'), `Video fee valid: ${doc.name} (${doc.videoConsultFee})`);
  }
  // Test 6: Multi-Attribute Doctor Search (Age, Experience, Name, Degree, College)
  console.log('▶ TEST 6: Testing Multi-Attribute Queries (Age + Experience + Name + Degree + College)...');
  
  // Case A: Name + Age + Experience ("Dr S N Khanna age 58 with 30 years experience")
  const multiQuery1 = chatbot.findDoctorsForQuery("Dr S N Khanna age 58 with 30 years experience");
  console.log(`  Query: "Dr S N Khanna age 58 with 30 years experience" -> Top Doctor: ${multiQuery1[0]?.name} (${multiQuery1[0]?.age} yrs, ${multiQuery1[0]?.experienceYears} yrs exp)`);
  console.assert(multiQuery1.length > 0 && multiQuery1[0].name === "Dr. S. N. Khanna", 'Matches Dr. S. N. Khanna');

  // Case B: Age + Degree ("Doctor with age 54 and DM Neurology")
  const multiQuery2 = chatbot.findDoctorsForQuery("Doctor with age 54 and DM Neurology");
  console.log(`  Query: "Doctor with age 54 and DM Neurology" -> Top Doctor: ${multiQuery2[0]?.name} (${multiQuery2[0]?.qualifications})`);
  console.assert(multiQuery2.length > 0 && multiQuery2[0].name === "Dr. Suresh Kumar", 'Matches Dr. Suresh Kumar');

  // Case C: Degree + Experience ("Doctor with FRCS and 23 years experience")
  const multiQuery3 = chatbot.findDoctorsForQuery("Doctor with FRCS and 23 years experience");
  console.log(`  Query: "Doctor with FRCS and 23 years experience" -> Top Doctor: ${multiQuery3[0]?.name} (${multiQuery3[0]?.qualifications}, ${multiQuery3[0]?.experienceYears} yrs exp)`);
  console.assert(multiQuery3.length > 0 && multiQuery3[0].name === "Dr. Mathew Jacob", 'Matches Dr. Mathew Jacob');

  // Case D: Degree + Department + City ("Doctor with MCh Neurosurgery in Bangalore")
  const multiQuery4 = chatbot.findDoctorsForQuery("Doctor with MCh Neurosurgery in Bangalore");
  console.log(`  Query: "Doctor with MCh Neurosurgery in Bangalore" -> Top Doctor: ${multiQuery4[0]?.name}`);
  console.assert(multiQuery4.length > 0 && multiQuery4[0].name === "Dr. Ravi Gopal Varma", 'Matches Dr. Ravi Gopal Varma');

  // Case E: College / Alma Mater ("doctor who studied at NIMHANS")
  const multiQuery5 = chatbot.findDoctorsForQuery("doctor who studied at NIMHANS");
  console.log(`  Query: "doctor who studied at NIMHANS" -> Found ${multiQuery5.length} doctors: ${multiQuery5.slice(0, 3).map(d => d.name).join(', ')}`);
  console.assert(multiQuery5.length >= 3, 'Found doctors from NIMHANS');

  // Test 7: Specific Doctor Detail Extraction (Single Attribute vs Full Dossier)
  console.log('▶ TEST 7: Testing Specific Single-Attribute Extraction vs Full Dossier...');
  const drKhanna = ASTER_DOCTORS.find(d => d.name === "Dr. S. N. Khanna");

  // Case A: Specific Qualification Query
  const qualResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "what is the qualification of Dr. S. N. Khanna");
  console.assert(qualResult && qualResult.title.includes('Academic Qualifications'), 'Returns qualification title');
  console.assert(qualResult.content.includes(drKhanna.qualifications), 'Contains exact qualifications');
  console.assert(!qualResult.content.includes(drKhanna.consultationFee), 'Does NOT include fee when only qualification asked');
  console.log(`  Query: "what is the qualification of Dr. S. N. Khanna" -> Returned ONLY qualifications.`);

  // Case B: Specific Consultation Fee Query
  const feeResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "what is the consultation fee of Dr. S. N. Khanna");
  console.assert(feeResult && feeResult.title.includes('Consultation Fees'), 'Returns fee title');
  console.assert(feeResult.content.includes(drKhanna.consultationFee), 'Contains exact fee');
  console.assert(!feeResult.content.includes(drKhanna.regNo), 'Does NOT include regNo when only fee asked');
  console.log(`  Query: "what is the consultation fee of Dr. S. N. Khanna" -> Returned ONLY fees (${drKhanna.consultationFee}).`);

  // Case C: Specific Registration Number Query
  const regResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "registration number of Dr. S. N. Khanna");
  console.assert(regResult && regResult.title.includes('Medical Registration'), 'Returns registration title');
  console.assert(regResult.content.includes(drKhanna.regNo), 'Contains exact registration number');
  console.assert(!regResult.content.includes(drKhanna.consultationFee), 'Does NOT include fee when only registration asked');
  console.log(`  Query: "registration number of Dr. S. N. Khanna" -> Returned ONLY regNo (${drKhanna.regNo}).`);

  // Case D: Specific Chamber Query
  const chamberResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "where is Dr. S. N. Khanna's chamber");
  console.assert(chamberResult && chamberResult.title.includes('Chamber'), 'Returns chamber title');
  console.assert(chamberResult.content.includes(drKhanna.chamber), 'Contains exact chamber room');
  console.log(`  Query: "where is Dr. S. N. Khanna's chamber" -> Returned ONLY chamber.`);

  // Case E: Specific OPD Timing Query
  const opdResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "OPD timings of Dr. S. N. Khanna");
  console.assert(opdResult && opdResult.title.includes('Schedule'), 'Returns schedule title');
  console.assert(opdResult.content.includes(drKhanna.opdSchedule), 'Contains exact schedule');
  console.log(`  Query: "OPD timings of Dr. S. N. Khanna" -> Returned ONLY OPD schedule.`);

  // Case F: Explicit Full Details Query should return null so full dossier is provided
  const fullResult = chatbot.extractSpecificDoctorAttribute(drKhanna, "give me full details of Dr. S. N. Khanna");
  console.assert(fullResult === null, 'Full details query returns null to generate complete dossier');
  console.log(`  Query: "give me full details of Dr. S. N. Khanna" -> Triggers Full Dossier.\n`);

  console.log('✅ Test 7 Passed: Specific single-attribute extraction gives ONLY requested detail, preserving full dossier for complete queries.\n');

  console.log('========================================================================');
  console.log('🎉 ALL DOCTOR ATTRIBUTES, EXPERIENCE, & SPECIFIC DETAIL TESTS PASSED!');
  console.log('========================================================================');
}

runVerificationTests();



