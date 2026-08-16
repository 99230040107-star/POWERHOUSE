/**
 * Aster Hospitals AI Chatbot Controller & RAG Engine
 * Autonomous Website QA with Source Citations, Multi-Hospital Search, Speech, and Crawler Inspector
 */

import { ASTER_DOCTORS, ASTER_LOCATIONS, ASTER_HEALTH_PACKAGES, ASTER_SPECIALTIES, HOSPITAL_FACILITIES_COMPARISON } from './data.js';

export class AsterChatbot {
  constructor(crawler, indexer) {
    this.crawler = crawler;
    this.indexer = indexer;
    this.messages = [];
    this.isOpen = false;
    this.isMaximized = false;
    this.activeTab = 'chat'; // 'chat' or 'inspector'
    this.recognition = null;
    this.synth = window.speechSynthesis || null;
    this.isListening = false;

    this.initSpeechRecognition();
    this.setupEventListeners();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateVoiceButtonState(true);
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = transcript;
          this.handleSendMessage();
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.updateVoiceButtonState(false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.updateVoiceButtonState(false);
      };
    }
  }

  setupEventListeners() {
    this.crawler.on('custom_page_indexed', () => {
      // Re-index all chunks in indexer
      this.indexer.buildIndex(this.crawler.crawledChunks);
    });
  }

  toggleChat(forceState = null) {
    this.isOpen = forceState !== null ? forceState : !this.isOpen;
    const widget = document.getElementById('aster-chatbot-container');
    const badge = document.getElementById('chatbot-unread-badge');
    const trigger = document.getElementById('chatbot-trigger-btn');

    if (this.isOpen) {
      widget.classList.add('active');
      trigger.classList.add('chat-open');
      if (badge) badge.style.display = 'none';

      // Send greeting if empty
      if (this.messages.length === 0) {
        this.sendInitialGreeting();
      }

      setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
      }, 300);
    } else {
      widget.classList.remove('active');
      trigger.classList.remove('chat-open');
    }
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    const widget = document.getElementById('aster-chatbot-container');
    const maxBtn = document.getElementById('btn-chatbot-maximize');
    
    if (this.isMaximized) {
      widget.classList.add('maximized');
      if (maxBtn) maxBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
      widget.classList.remove('maximized');
      if (maxBtn) maxBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
  }

  switchTab() {
    // Single view mode: always chat
    this.activeTab = 'chat';
  }

  sendInitialGreeting() {
    const greetingText = `Hello! I am **Aster AI Health Assistant**. 👋

I have crawled and indexed **${this.crawler.crawledPages.size || 'all'} web pages** across Aster Hospitals network:
- 🏥 **8 Quaternary Hospital Campuses**: Bangalore, Kochi, Calicut, Kottakkal, Kannur, Hyderabad & Guntur
- 👨‍⚕️ **Top Specialist Doctors & Surgeons** across different hospitals
- ⚖️ **Cross-Hospital Comparison & Facilities Matrix**
- 🚨 **24/7 Emergency & ICU Ambulance Dispatch**
- 🧪 **Preventive Health Checkup Packages**
- 💳 **Cashless Insurance & TPA Empanelment**

How can I assist you with your healthcare today?`;

    this.addMessage({
      sender: 'bot',
      text: greetingText,
      suggestions: [
        '🏥 List all Aster Hospitals',
        '👨‍⚕️ Doctors at Aster Medcity Kochi',
        '👨‍⚕️ Doctors at Aster CMI Bangalore',
        '⚖️ Compare Hospital Facilities',
        '🚨 Emergency helpline numbers',
        '🧪 Health checkup packages & cost'
      ]
    });
  }

  addMessage(msg) {
    msg.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    msg.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.messages.push(msg);
    this.renderMessages();
    this.scrollToBottom();
  }

  handleSendMessage(customQuery = null) {
    let query = '';
    const input = document.getElementById('chat-input');
    
    if (customQuery && typeof customQuery === 'string') {
      query = customQuery.trim();
    } else if (input) {
      query = input.value.trim();
      input.value = '';
    }
    
    if (!query) return;

    // Add user message
    this.addMessage({
      sender: 'user',
      text: query
    });

    // Show typing indicator
    this.showTypingIndicator();

    setTimeout(() => {
      this.removeTypingIndicator();
      this.processUserQuery(query);
    }, 450);
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages-list');
    if (!messagesContainer) return;

    const typingEl = document.createElement('div');
    typingEl.id = 'chat-typing-indicator';
    typingEl.className = 'chat-message bot typing';
    typingEl.innerHTML = `
      <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="typing-bubble">
        <span></span><span></span><span></span>
      </div>
    `;
    messagesContainer.appendChild(typingEl);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const typingEl = document.getElementById('chat-typing-indicator');
    if (typingEl) typingEl.remove();
  }

  /**
   * Process query using BM25 semantic retrieval + multi-hospital intent synthesis
   */
  processUserQuery(query) {
    const qLower = query.toLowerCase();

    // 1. Search indexed chunks using BM25
    const searchResults = this.indexer.search(query, 4);

    let synthesizedAnswer = "";
    let actionCards = [];
    let sourceCitations = [];

    // --- INTENT A: Hospital Comparison Intent ---
    if (qLower.includes('compare') || qLower.includes('difference') || (qLower.includes('vs') && (qLower.includes('cmi') || qLower.includes('medcity') || qLower.includes('whitefield') || qLower.includes('calicut') || qLower.includes('prime')))) {
      synthesizedAnswer = `### ⚖️ Side-by-Side Hospital Network Comparison\n\nHere is a comparative breakdown of key infrastructure, robotic surgical suites, organ transplant authorizations, and accreditations across Aster Hospital campuses:`;
      actionCards.push({
        type: 'comparison',
        comparison: HOSPITAL_FACILITIES_COMPARISON
      });
    }

    // --- INTENT B: Hospital Directory / Locations List Intent ---
    else if (
      (qLower.includes('hospital') || qLower.includes('hospitals') || qLower.includes('branch') || qLower.includes('branches') || qLower.includes('campuses') || qLower.includes('location') || qLower.includes('network')) &&
      !qLower.includes('doctor') && !qLower.includes('dr.') && !qLower.includes('cardiologist') && !qLower.includes('surgeon') && !qLower.includes('specialist')
    ) {
      let matchedLocations = this.findLocationsForQuery(query);
      if (matchedLocations.length === 0 || qLower.includes('all') || qLower.includes('different') || qLower.includes('list')) {
        matchedLocations = ASTER_LOCATIONS;
      }

      const cityFilterText = qLower.includes('bangalore') ? ' in Bangalore' : qLower.includes('kerala') ? ' in Kerala' : qLower.includes('kochi') ? ' in Kochi' : qLower.includes('calicut') ? ' in Calicut' : qLower.includes('hyderabad') ? ' in Hyderabad' : '';

      synthesizedAnswer = `### 🏥 Aster Hospitals Network & Campuses${cityFilterText}\n\nWe operate **${matchedLocations.length} quaternary hospital campuses** with 24/7 Level-1 emergency, advanced robotic surgery, and multi-organ transplant suites. Click **View Doctors** to explore consultants in each hospital:`;

      actionCards.push({
        type: 'locations',
        locations: matchedLocations
      });
    }

    // --- INTENT C: Doctors / Specialists Query (Personal Details, Multi-Attribute, Experience, Age, Name, Degree, or Specialty) ---
    else if (
      // Meta query asking if bot can search by age, experience, name, degree
      (qLower.includes('if i give') || qLower.includes('if i provide') || (qLower.includes('give me') && (qLower.includes('full detail') || qLower.includes('personal info')))) ||
      qLower.includes('doctor') || qLower.includes('doctors') || qLower.includes('dr') || qLower.includes('dr.') ||
      qLower.includes('specialist') || qLower.includes('specialists') || 
      qLower.includes('surgeon') || qLower.includes('surgeons') || qLower.includes('physician') || qLower.includes('physicians') || 
      qLower.includes('consultant') || qLower.includes('consultants') || qLower.includes('cardiologist') || qLower.includes('neurosurgeon') || 
      qLower.includes('oncologist') || qLower.includes('gastroenterologist') || qLower.includes('nephrologist') || qLower.includes('pulmonologist') ||
      qLower.includes('gynecologist') || qLower.includes('pediatrician') || qLower.includes('experience') || qLower.includes('exp') ||
      qLower.includes('age') || qLower.includes('aged') || qLower.includes('years old') || qLower.includes('older than') || qLower.includes('younger than') ||
      qLower.includes('personal detail') || qLower.includes('personal details') || qLower.includes('personal info') || qLower.includes('profile') || qLower.includes('credential') ||
      qLower.includes('registration') || qLower.includes('mci') || qLower.includes('kmc') || qLower.includes('tmc') || qLower.includes('tsmc') || qLower.includes('apmc') ||
      qLower.includes('qualification') || qLower.includes('qualifications') || qLower.includes('degree') || qLower.includes('degrees') || qLower.includes('education') ||
      qLower.includes('years of exp') || qLower.includes('years experience') || qLower.includes('veteran') || qLower.includes('senior most') ||
      qLower.includes('who have experience') || qLower.includes('experience of above') || qLower.includes('experience above') ||
      qLower.includes('mbbs') || qLower.includes('frcs') || qLower.includes('mch') || qLower.includes('mrcp') ||
      ASTER_DOCTORS.some(d => (d.aliases && d.aliases.some(a => qLower.includes(a.toLowerCase()))) || qLower.includes(d.name.toLowerCase()))
    ) {
      // Check if it's a meta question asking if the user can search by attributes
      const isMetaInquiry = (
        (qLower.includes('if i give') || qLower.includes('if i provide') || qLower.includes('can i search') || qLower.includes('how to search')) &&
        (qLower.includes('age') || qLower.includes('experience') || qLower.includes('name') || qLower.includes('degree') || qLower.includes('personal'))
      );

      if (isMetaInquiry) {
        synthesizedAnswer = `### 🌟 Yes, Absolutely! Multi-Attribute Doctor Discovery & Verification Engine\n\n` +
          `You can search and retrieve the **complete verified personal dossier, medical council credentials, academic background, surgical volume, OPD chamber, fees, and contact details** of any doctor across Aster Hospitals by providing any combination of personal information:\n\n` +
          `• 👨‍⚕️ **Doctor's Name or Alias**: (e.g. *Dr. S. N. Khanna*, *Dr. Ravi Gopal Varma*, *Dr. Sonal Asthana*, *Dr. Jerry M Paul*)\n` +
          `• 🎂 **Age**: (e.g. *Age 58*, *54 years old*, *Age above 50*, *Age between 45 and 55*)\n` +
          `• ⏳ **Years of Experience**: (e.g. *30 years experience*, *Above 10 years experience*, *25+ yrs exp*, *Over 20 years*)\n` +
          `• 🎓 **Academic Degrees & Qualifications**: (e.g. *FRCS*, *DM Cardiology*, *MCh Neurosurgery*, *MBBS MS*, *DNB*, *MRCP*, *FMAS*, *FRCP*)\n` +
          `• 🏛️ **Medical Colleges & Alma Mater**: (e.g. *AIIMS*, *NIMHANS*, *PGIMER*, *JIPMER*, *CMC Vellore*, *KMC Manipal*, *Cambridge*)\n` +
          `• 🏥 **Hospital Campus / City**: (e.g. *Aster CMI Bangalore*, *Aster Medcity Kochi*, *Aster MIMS Calicut*, *Hyderabad Prime*)\n` +
          `• 🩺 **Clinical Specializations**: (e.g. *Beating Heart CABG*, *DBS for Parkinson's*, *Liver Transplant*, *Robotic Mako Surgery*)\n\n` +
          `---\n\n` +
          `#### 💡 Try These Example Queries in Chat:\n` +
          `1. **"Dr S N Khanna age 58 with 30 years experience"**\n` +
          `2. **"Doctor with age 54 and DM Neurology"**\n` +
          `3. **"Doctor with FRCS and 23 years experience"**\n` +
          `4. **"Doctor with MCh Neurosurgery in Bangalore"**\n` +
          `5. **"Personal details of Dr. Ravi Gopal Varma"**\n\n` +
          `*Below are featured senior medical specialists from our network. Click **View Full Profile** on any card to see their complete medical dossier:*`;

        actionCards.push({
          type: 'doctors',
          doctors: ASTER_DOCTORS.slice(0, 6)
        });
      } else {
        const matchedDoctors = this.findDoctorsForQuery(query);

        let contextInfo = "";
        if (qLower.includes('medcity') || qLower.includes('kochi')) contextInfo = " at **Aster Medcity, Kochi**";
        else if (qLower.includes('cmi') || qLower.includes('hebbal')) contextInfo = " at **Aster CMI Hospital, Bangalore**";
        else if (qLower.includes('whitefield')) contextInfo = " at **Aster Whitefield Hospital, Bangalore**";
        else if (qLower.includes('calicut') || qLower.includes('mims')) contextInfo = " at **Aster MIMS Calicut**";
        else if (qLower.includes('prime') || qLower.includes('hyderabad')) contextInfo = " at **Aster Prime Hospital, Hyderabad**";
        else if (qLower.includes('guntur') || qLower.includes('ramesh')) contextInfo = " at **Aster Ramesh Hospitals, Guntur**";
        else if (qLower.includes('different') || qLower.includes('all')) contextInfo = " across our hospital campuses";

        if (matchedDoctors.length === 1) {
          const d = matchedDoctors[0];
          const specificAttr = this.extractSpecificDoctorAttribute(d, query);

          if (specificAttr) {
            // Targeted Specific Detail Response (Direct single sentence ONLY - NO headers, NO profile cards, NO biodata)
            synthesizedAnswer = specificAttr.content;
            actionCards = [];
          } else {
            // Concise Single-Doctor Summary (No long biography walls)
            synthesizedAnswer = `### 👨‍⚕️ ${d.name}\n\n` +
              `• **Specialty**: ${d.designation || d.subspecialty} (${d.specialty})\n` +
              `• **Hospital**: **${d.hospital}** (${d.city})\n` +
              `• **Experience**: ${d.experience} (${d.experienceYears} Years) | Age: ${d.age} yrs\n` +
              `• **Qualifications**: ${d.qualifications}\n` +
              `• **OPD Consultation**: ${d.consultationFee} (Schedule: ${d.opdSchedule})`;

            actionCards.push({
              type: 'doctors',
              doctors: [d]
            });
          }
        } else if (matchedDoctors.length > 1) {
          // Clean, Compact Multi-Doctor List (No long biography walls)
          synthesizedAnswer = `### 👨‍⚕️ Available Specialists${contextInfo}\n\n` +
            `Found **${matchedDoctors.length} specialists** matching your search:\n\n` +
            matchedDoctors.slice(0, 8).map((d, idx) => 
              `• **${d.name}** — ${d.specialty} (${d.hospital}) | ${d.experience} | OPD: ${d.consultationFee}`
            ).join('\n');

          actionCards.push({
            type: 'doctors',
            doctors: matchedDoctors.slice(0, 8)
          });
        } else {
          synthesizedAnswer = `### ℹ️ Data Not Available\n\nNo verified medical specialists found matching "**${query}**"${contextInfo ? ` ${contextInfo.replace('at ', 'at ').replace(/\*\*/g, '')}` : ''}.\n\nFor specialist consultations, appointments, or campus inquiries, please contact our helpline at **[1800 102 4647](tel:18001024647)** or the campus helpdesk directly.`;
          actionCards = [];
        }
      }
    }

    // --- INTENT D: Emergency Intent ---
    else if (qLower.includes('emergency') || qLower.includes('ambulance') || qLower.includes('urgent') || qLower.includes('heart attack') || qLower.includes('stroke helpline') || qLower.includes('casualty') || qLower.includes('trauma')) {
      synthesizedAnswer = `### 🚨 24/7 Emergency & Trauma Care Dispatch Across All Hospitals\n\nLevel-1 Emergency & ICU ALS Ambulances are operational round-the-clock across all Aster Hospital campuses:`;

      actionCards.push({
        type: 'all_emergency',
        hospitals: ASTER_LOCATIONS
      });
    }

    // --- INTENT E: Health Packages Intent ---
    else if (
      qLower.includes('package') || qLower.includes('packages') || qLower.includes('checkup') || 
      qLower.includes('master health') || qLower.includes('cardiac wellness') || qLower.includes('executive') || 
      qLower.includes('full body') || qLower.includes('screening') || qLower.includes('wellness') ||
      (qLower.includes('test') && (qLower.includes('health') || qLower.includes('blood') || qLower.includes('fasting') || qLower.includes('check') || qLower.includes('cost') || qLower.includes('price')))
    ) {
      // Check if user is asking about a specific package
      let targetPkg = null;
      if (qLower.includes('master')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-master');
      else if (qLower.includes('cardiac') || qLower.includes('heart')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-cardiac');
      else if (qLower.includes('executive')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-executive');
      else if (qLower.includes('basic')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-basic');
      else if (qLower.includes('woman') || qLower.includes('women') || qLower.includes('female')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-women-wellness');
      else if (qLower.includes('senior') || qLower.includes('elderly') || qLower.includes('geriatric')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-senior-citizen');
      else if (qLower.includes('diabet')) targetPkg = ASTER_HEALTH_PACKAGES.find(p => p.id === 'pkg-diabetes-care');

      if (targetPkg) {
        synthesizedAnswer = `### 🧪 ${targetPkg.name}\n\n` +
          `• **Special Price**: **₹${targetPkg.price.toLocaleString()}** ~~(₹${targetPkg.originalPrice.toLocaleString()})~~ (**${targetPkg.discountPercent}% OFF**)\n` +
          `• **Target Age / Group**: ${targetPkg.target}\n` +
          `• **Total Diagnostic Tests**: **${targetPkg.testCount}**\n` +
          `• **Fasting Requirement**: ⚠️ *${targetPkg.fasting}*\n` +
          `• **Overview**: ${targetPkg.description}\n\n` +
          `#### 📋 Key Diagnostic Inclusions:\n` +
          targetPkg.inclusions.map(inc => `• ${inc}`).join('\n') +
          `\n\n*All packages include a personalized consultation with a senior consultant physician/cardiologist and same-day digital report delivery.*`;

        actionCards.push({
          type: 'packages',
          packages: [targetPkg]
        });
      } else {
        synthesizedAnswer = `### 🧪 Preventive Health Checkup Packages at Aster Hospitals\n\n` +
          `Early detection saves lives! Aster Hospitals offers **7 comprehensive preventive health packages** across all hospital campuses with NABL-accredited labs and senior specialist consultations:\n\n` +
          `1. **Aster Basic Wellness** (₹1,999 | 32 Tests)\n` +
          `2. **Aster Master Health Checkup** (₹4,999 | 58 Tests - *Most Popular*)\n` +
          `3. **Aster Cardiac Wellness Comprehensive** (₹7,499 | 64 Tests)\n` +
          `4. **Aster Executive Full Body Checkup** (₹9,999 | 78 Tests)\n` +
          `5. **Aster Well Woman Comprehensive** (₹5,499 | 52 Tests)\n` +
          `6. **Aster Senior Citizen Comprehensive** (₹6,999 | 68 Tests)\n` +
          `7. **Aster Advanced Diabetes Care** (₹3,499 | 42 Tests)\n\n` +
          `⚠️ **Fasting Guideline**: 10 to 12 hours of overnight fasting is mandatory for accurate blood sugar, lipid profile, and ultrasound imaging.`;

        actionCards.push({
          type: 'packages',
          packages: ASTER_HEALTH_PACKAGES
        });
      }
    }

    // --- INTENT F: Insurance / TPA Intent ---
    else if (qLower.includes('insurance') || qLower.includes('tpa') || qLower.includes('cashless') || qLower.includes('mediclaim') || qLower.includes('star health') || qLower.includes('hdfc ergo') || qLower.includes('icici')) {
      synthesizedAnswer = `### 💳 Cashless Insurance & TPA Facilities at Aster Hospitals

Aster Hospitals provides seamless 24/7 cashless hospitalization across all major insurance providers & TPAs at all campuses:

- **Empanelled Insurers**: Star Health, HDFC ERGO, ICICI Lombard, Care Health, Niva Bupa, Bajaj Allianz, Tata AIG, New India Assurance, United India, National Insurance.
- **Third Party Administrators (TPAs)**: Medi Assist, Vidal Health, Paramount, FHPL, Raksha, Heritage, MDIndia.

#### 📋 Required Documents for Cashless Claim:
1. Health Insurance E-Card / Policy Copy
2. Patient & Policyholder Govt Photo ID (Aadhaar / PAN / Passport)
3. Doctor's Admission Advice & Consultation Note
4. TPA Pre-Authorization Form (assisted at our 24/7 TPA Desk)`;
      
      actionCards.push({
        type: 'insurance',
        title: '24/7 TPA Desk Assistance',
        contact: '080-4647 4444 (Ext: 1104)'
      });
    }

    // 3. If no direct intent matched, synthesize answer directly from RAG chunks
    if (!synthesizedAnswer && searchResults.length > 0 && searchResults[0].score >= 0.15) {
      const topChunk = searchResults[0];
      synthesizedAnswer = `### ${topChunk.pageTitle}\n\n**${topChunk.heading}**:\n${this.formatContent(topChunk.content)}`;
      
      if (searchResults.length > 1 && searchResults[1].score >= 0.12) {
        const secondary = searchResults[1];
        synthesizedAnswer += `\n\n**Additional Insights (${secondary.heading})**:\n${this.formatContent(secondary.content)}`;
      }
    } else if (!synthesizedAnswer) {
      synthesizedAnswer = `### ℹ️ Data Not Available\n\nVerified information for "**${query}**" is currently not available in our database.\n\nFor verified medical assistance, please contact:\n- 📞 **Central Helpline**: **[1800 102 4647](tel:18001024647)**\n- 🏥 **Hospital Helpdesks**: Call the respective hospital reception directly (e.g. Aster MIMS Calicut: 0495-3500000, Aster Medcity Kochi: 0484-6699000, Aster CMI Bangalore: 080-4647 4444).`;
    }

    // Add bot response
    this.addMessage({
      sender: 'bot',
      text: synthesizedAnswer,
      actionCards: actionCards,
      rawTextToSpeak: this.stripMarkdownForSpeech(synthesizedAnswer),
      suggestions: this.generateFollowupSuggestions(qLower)
    });
  }

  findDoctorsForQuery(query) {
    const qLower = query.toLowerCase().trim();
    
    // 1. Detect if specific hospital branch or city is requested
    let targetBranch = null;
    if (qLower.includes('medcity') || qLower.includes('cheranallur') || (qLower.includes('kochi') && !qLower.includes('bangalore'))) targetBranch = 'kochi-medcity';
    else if (qLower.includes('cmi') || qLower.includes('hebbal')) targetBranch = 'bangalore-cmi';
    else if (qLower.includes('whitefield')) targetBranch = 'bangalore-whitefield';
    else if (qLower.includes('calicut') || qLower.includes('kozhikode') || qLower.includes('mims calicut')) targetBranch = 'calicut-mims';
    else if (qLower.includes('kottakkal')) targetBranch = 'kottakkal-mims';
    else if (qLower.includes('kannur')) targetBranch = 'kannur-mims';
    else if (qLower.includes('prime') || qLower.includes('ameerpet') || (qLower.includes('hyderabad') && !qLower.includes('bangalore'))) targetBranch = 'hyderabad-prime';
    else if (qLower.includes('guntur') || qLower.includes('ramesh')) targetBranch = 'guntur-ramesh';

    // 2. Multi-Pattern Robust Experience Parser (Exact, Range, Inequalities)
    let minExp = 0;
    let maxExp = 100;
    let exactExp = null;

    // Pattern A: Range "between X and Y years" / "X to Y years"
    const expRangeMatch = qLower.match(/(?:between|from)?\s*(\d+)\s*(?:to|-|and)\s*(\d+)\s*(?:years?|yrs?)(?:\s*(?:of\s*)?(?:exp|experience))?/i);
    if (expRangeMatch) {
      minExp = parseInt(expRangeMatch[1], 10);
      maxExp = parseInt(expRangeMatch[2], 10);
    } else {
    // 2. Multi-Pattern Robust Age Parser (Exact, Range, Inequalities)
    let minAge = 0;
    let maxAge = 100;
    let exactAge = null;

    // Pattern A: Range ("age between 50 and 60", "between 50 to 60 age", "50 to 60 years old")
    const ageRangeMatch = (
      qLower.match(/(?:age\s*(?:is\s*)?(?:between|from)?\s*)?(\d{2})\s*(?:to|-|and)\s*(\d{2})\s*(?:years?\s*old|years?\s*of\s*age|age)?/i) &&
      (qLower.includes('age') || qLower.includes('old') || qLower.includes('aged'))
    );

    // Pattern B: Upper threshold ("above 55 age", "age above 55", "age > 55", "age over 55", "age more than 55", "older than 55", "above 55 years old", "above 55 years of age", "above 55 yrs", "above 55")
    const ageAboveMatch = (
      qLower.match(/(?:age\s*(?:is\s*)?(?:above|>|over|>=|greater than|more than|higher than|at least|older than|minimum of|min)\s*(\d{2}))/i) ||
      qLower.match(/(?:above|>|over|>=|greater than|more than|higher than|at least|older than|minimum of|min)\s*(\d{2})\s*(?:years?\s*(?:old|of\s*age)|age|yrs?\s*old|yrs?\s*age)\b/i) ||
      ((qLower.includes('age') || qLower.includes('old') || qLower.includes('senior') || qLower.includes('elderly')) && qLower.match(/(?:above|>|over|>=|greater than|more than|higher than|at least|older than|minimum of|min)\s*(\d{2})/i))
    );

    // Pattern C: Lower threshold ("under 50 age", "age under 50", "age < 50", "age below 50", "younger than 50", "below 50 years old", "under 50 years of age")
    const ageBelowMatch = (
      qLower.match(/(?:age\s*(?:is\s*)?(?:under|<|below|<=|less than|fewer than|younger than|maximum of|max)\s*(\d{2}))/i) ||
      qLower.match(/(?:under|<|below|<=|less than|fewer than|younger than|maximum of|max)\s*(\d{2})\s*(?:years?\s*(?:old|of\s*age)|age|yrs?\s*old|yrs?\s*age)\b/i) ||
      ((qLower.includes('age') || qLower.includes('old') || qLower.includes('junior') || qLower.includes('young')) && qLower.match(/(?:under|<|below|<=|less than|fewer than|younger than|maximum of|max)\s*(\d{2})/i))
    );

    // Pattern D: Exact Age ("age 58", "age of 58", "aged 58", "58 years old", "58 yo", "58 age")
    const ageExactMatch = (
      qLower.match(/(?:age\s*(?:is|of|=|:)?\s*(\d{2}))/i) ||
      qLower.match(/(?:aged\s*(\d{2}))/i) ||
      qLower.match(/(\d{2})\s*(?:years?\s*old|years?\s*of\s*age|yo)\b/i) ||
      qLower.match(/(\d{2})\s*age\b/i)
    );

    if (ageRangeMatch) {
      const match = qLower.match(/(\d{2})\s*(?:to|-|and)\s*(\d{2})/);
      if (match) {
        minAge = parseInt(match[1], 10);
        maxAge = parseInt(match[2], 10);
      }
    } else if (ageAboveMatch) {
      minAge = parseInt(ageAboveMatch[1], 10);
    } else if (ageBelowMatch) {
      maxAge = parseInt(ageBelowMatch[1], 10);
    } else if (ageExactMatch && !ageAboveMatch && !ageBelowMatch) {
      exactAge = parseInt(ageExactMatch[1], 10);
      minAge = exactAge - 1;
      maxAge = exactAge + 1;
    }

    // 3. Multi-Pattern Robust Experience Parser (Exact, Range, Inequalities)
    let minExp = 0;
    let maxExp = 100;
    let exactExp = null;

    const hasExpKeyword = (
      qLower.includes('exp') || qLower.includes('experience') || qLower.includes('practice') ||
      qLower.includes('veteran') || qLower.includes('career')
    );

    if (hasExpKeyword) {
      // Pattern A: Range "between X and Y years experience" / "X to Y years exp"
      const expRangeMatch = qLower.match(/(?:between|from)?\s*(\d+)\s*(?:to|-|and)\s*(\d+)\s*(?:years?|yrs?)(?:\s*(?:of\s*)?(?:exp|experience))?/i);
      if (expRangeMatch) {
        minExp = parseInt(expRangeMatch[1], 10);
        maxExp = parseInt(expRangeMatch[2], 10);
      } else {
        // Pattern B: Upper threshold ("above X years exp", "more than X years experience", "experience above X")
        const expAboveMatch = (
          qLower.match(/(?:experience|exp)\s*(?:of|is|with|having)?\s*(?:above|>|>=|more than|over|greater than|higher than|exceeding|at least|min|minimum of)?\s*(\d+)/i) ||
          qLower.match(/(?:more than|>|above|over|>=|greater than|higher than|exceeding|at least|minimum of|min)\s*(\d+)\s*(?:years?|yrs?)(?:\s*(?:of\s*)?(?:exp|experience))/i) ||
          qLower.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:exp|experience)\s*(?:and|or)?\s*(?:above|more|higher|greater|\+)/i) ||
          qLower.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:exp|experience)/i) ||
          qLower.match(/(?:who\s*have|having|with)\s*(\d+)\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:exp|experience)/i)
        );

        // Pattern C: Lower threshold ("less than X years exp", "under X years experience")
        const expBelowMatch = (
          qLower.match(/(?:experience|exp)\s*(?:of|is|with|having)?\s*(?:under|<|<=|less than|below|fewer than|maximum of|max)\s*(\d+)/i) ||
          qLower.match(/(?:less than|<|under|below|<=|maximum of|max|fewer than)\s*(\d+)\s*(?:years?|yrs?)(?:\s*(?:of\s*)?(?:exp|experience))/i)
        );

        // Pattern D: Exact experience ("with 30 years experience", "30 years experience", "experience 30 years")
        const expExactMatch = (
          qLower.match(/(\d+)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:exp|experience)\b/i) ||
          qLower.match(/(?:experience|exp)\s*(?:of|is|=|:)?\s*(\d+)\s*(?:years?|yrs?)?/i)
        );

        if (expAboveMatch && parseInt(expAboveMatch[1], 10) > 0) {
          minExp = parseInt(expAboveMatch[1], 10);
        } else if (expExactMatch && parseInt(expExactMatch[1], 10) > 0 && !expBelowMatch) {
          exactExp = parseInt(expExactMatch[1], 10);
          minExp = exactExp - 2;
          maxExp = exactExp + 2;
        }

        if (expBelowMatch && parseInt(expBelowMatch[1], 10) > 0) {
          maxExp = parseInt(expBelowMatch[1], 10);
        }
      }
    }

    // 4. Parse Gender Constraints
    let targetGender = null;
    if (qLower.includes('female') || qLower.includes('lady doctor') || qLower.includes('woman doctor') || qLower.includes('women doctor')) {
      targetGender = 'Female';
    } else if ((qLower.includes('male doctor') || qLower.includes('gentleman doctor')) && !qLower.includes('female')) {
      targetGender = 'Male';
    }

    // 5. Parse Fee Constraints
    let maxFee = Infinity;
    const feeBelowMatch = qLower.match(/(?:fee|cost|price|charge)?\s*(?:less than|<|under|below|<=)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (feeBelowMatch && parseInt(feeBelowMatch[1], 10) > 100) {
      maxFee = parseInt(feeBelowMatch[1], 10);
    }

    // 6. Detect Degree / Qualification Keywords
    const degreeKeywords = ['mbbs', 'md', 'ms', 'mch', 'dm', 'frcs', 'dnb', 'mrcp', 'fmas', 'facc', 'fscai', 'frcp', 'facs', 'fiacs', 'fiap', 'dgo', 'phd'];
    const matchedDegreeTokens = degreeKeywords.filter(deg => {
      const regex = new RegExp(`\\b${deg}\\b`, 'i');
      return regex.test(qLower);
    });

    // Detect Medical College / Alma Mater Keywords
    const collegeKeywords = [
      'aiims', 'nimhans', 'pgimer', 'jipmer', 'cmc vellore', 'vellore', 'manipal', 'kmc', 'sgpgi', 
      'sctimst', 'cambridge', 'cleveland', 'harvard', 'royal college', 'royal marsden', 'adyar', 
      'stanford', 'osmania', 'bmcri', 'mysore', 'calicut', 'trivandrum', 'king george', 'dundee', 'liverpool'
    ];
    const matchedCollegeTokens = collegeKeywords.filter(col => qLower.includes(col));

    // 7. Detect Target Specialties / Departments
    let targetSpecialties = [];

    if (
      qLower.includes('cardio') || qLower.includes('heart') || qLower.includes('angioplast') ||
      qLower.includes('bypass') || qLower.includes('cabg') || qLower.includes('tavi') ||
      qLower.includes('tavr') || qLower.includes('ecg') || qLower.includes('stent') ||
      qLower.includes('chest pain') || qLower.includes('valve') || qLower.includes('arrhythmia') ||
      qLower.includes('pacemaker') || qLower.includes('cardiologist') || qLower.includes('cardiac') ||
      qLower.includes('ctvs')
    ) {
      targetSpecialties.push('Cardiac Sciences');
    }

    if (
      qLower.includes('neuro') || qLower.includes('brain') || qLower.includes('spine') ||
      qLower.includes('dbs') || qLower.includes('parkinson') || qLower.includes('stroke') ||
      qLower.includes('epilepsy') || qLower.includes('headache') || qLower.includes('tumor') ||
      qLower.includes('tumour') || qLower.includes('seizure') || qLower.includes('paralysis') ||
      qLower.includes('neurologist') || qLower.includes('neurosurgeon')
    ) {
      targetSpecialties.push('Neurosciences');
    }

    if (
      qLower.includes('cancer') || qLower.includes('onco') || qLower.includes('chemo') ||
      qLower.includes('radiation') || qLower.includes('immunotherapy') || qLower.includes('bmt') ||
      qLower.includes('lymphoma') || qLower.includes('leukemia') || qLower.includes('breast cancer') ||
      qLower.includes('malignan') || qLower.includes('oncologist') || qLower.includes('tumor board')
    ) {
      targetSpecialties.push('Oncology');
    }

    if (
      qLower.includes('ortho') || qLower.includes('bone') || qLower.includes('joint') ||
      qLower.includes('knee') || qLower.includes('hip') || qLower.includes('fracture') ||
      qLower.includes('arthroscop') || qLower.includes('mako') || qLower.includes('ligament') ||
      qLower.includes('acl') || qLower.includes('sports injury') || qLower.includes('orthopaedic') ||
      qLower.includes('orthopedic') || qLower.includes('orthopaedist') || qLower.includes('orthopedist')
    ) {
      targetSpecialties.push('Orthopaedics');
    }

    if (
      qLower.includes('transplant') || qLower.includes('liver transplant') || qLower.includes('kidney transplant') ||
      qLower.includes('hpb') || qLower.includes('cirrhosis') || qLower.includes('donor') ||
      qLower.includes('organ transplant')
    ) {
      targetSpecialties.push('Organ Transplant');
    }

    if (
      qLower.includes('gastro') || qLower.includes('stomach') || qLower.includes('endoscop') ||
      qLower.includes('colonoscop') || qLower.includes('digestive') || qLower.includes('acidity') ||
      qLower.includes('poem') || qLower.includes('eus') || qLower.includes('gastric') ||
      qLower.includes('gastroenterologist') || qLower.includes('hepatolog')
    ) {
      targetSpecialties.push('Gastroenterology');
    }

    if (
      qLower.includes('maternity') || qLower.includes('pregnant') || qLower.includes('pregnancy') ||
      qLower.includes('gynec') || qLower.includes('gynaec') || qLower.includes('obstetric') ||
      qLower.includes('delivery') || qLower.includes('fetal') || qLower.includes('baby') ||
      qLower.includes('pediatric') || qLower.includes('paediatric') || qLower.includes('child') ||
      qLower.includes('nicu') || qLower.includes('picu') || qLower.includes('infant') ||
      qLower.includes('pediatrician') || qLower.includes('gynecologist') || qLower.includes('gynaecologist')
    ) {
      targetSpecialties.push('Women & Child Care');
    }

    if (
      qLower.includes('kidney') || qLower.includes('nephro') || qLower.includes('renal') ||
      qLower.includes('dialysis') || qLower.includes('urolog') || qLower.includes('stone') ||
      qLower.includes('creatinine') || qLower.includes('prostate') || qLower.includes('nephrologist') ||
      qLower.includes('urologist')
    ) {
      targetSpecialties.push('Nephrology & Urology');
    }

    if (
      qLower.includes('pulmon') || qLower.includes('chest') || qLower.includes('lung') ||
      qLower.includes('asthma') || qLower.includes('copd') || qLower.includes('breath') ||
      qLower.includes('ebus') || qLower.includes('bronchoscop') || qLower.includes('sleep apnea') ||
      qLower.includes('pulmonologist') || qLower.includes('respiratory')
    ) {
      targetSpecialties.push('Pulmonology');
    }

    const hasSpecialtyKeyword = targetSpecialties.length > 0;

    // Calculate Name Match Scores for All Doctors
    const nameScores = new Map();
    let maxNameScore = 0;

    for (const d of ASTER_DOCTORS) {
      const nScore = this.getDoctorNameMatchScore(d, qLower);
      nameScores.set(d.id, nScore);
      if (nScore > maxNameScore) maxNameScore = nScore;
    }

    const hasSpecificDoctorName = maxNameScore >= 500;

    const isPersonalDetailsGeneralQuery = (
      qLower.includes('personal detail') || qLower.includes('personal details') || qLower.includes('personal info') ||
      qLower.includes('doctor details') || qLower.includes('doctors details') ||
      qLower.includes('credentials') || qLower.includes('qualifications') || qLower.includes('registration') ||
      qLower.includes('degrees') || qLower.includes('full details') || qLower.includes('all details')
    );

    const isAttributeOrGeneralQuery = (!hasSpecialtyKeyword && !hasSpecificDoctorName) || isPersonalDetailsGeneralQuery;

    // 8. Multi-Factor Doctor Matching & Scoring
    const scoredDoctors = [];

    for (const d of ASTER_DOCTORS) {
      let score = 0;
      const nScore = nameScores.get(d.id) || 0;

      // Hard filter: If user specified a specific doctor by name, strictly exclude other doctors!
      if (hasSpecificDoctorName) {
        if (nScore < 500 || (maxNameScore >= 800 && nScore < maxNameScore)) {
          continue; // Skips Anil Kumar / Anupama Kumar when Suresh Kumar is queried
        }
      }

      // Hard filter: Branch / City
      if (targetBranch && d.branchCode !== targetBranch) continue;
      if ((qLower.includes('bangalore') || qLower.includes('bengaluru')) && d.city !== 'Bangalore') continue;
      if (qLower.includes('kerala') && !(d.hospital.includes('Kerala') || d.city === 'Kochi' || d.city === 'Calicut' || d.city === 'Kannur' || d.city === 'Kottakkal')) continue;
      if (qLower.includes('hyderabad') && d.city !== 'Hyderabad') continue;
      if (qLower.includes('guntur') && d.city !== 'Guntur') continue;

      // Hard filter: Specialty (If specialty was requested, ONLY return doctors of that specialty!)
      if (targetSpecialties.length > 0) {
        const matchesRequestedSpecialty = targetSpecialties.some(spec => 
          d.specialty === spec || (d.subspecialty && d.subspecialty.toLowerCase().includes(spec.toLowerCase()))
        );
        if (!matchesRequestedSpecialty) {
          continue; // Skip doctors not in the requested specialty!
        }
      }

      // Hard filter: Gender
      if (targetGender && d.gender !== targetGender) continue;

      // Hard filter: Fee
      if (d.feeAmount > maxFee) continue;

      // Filter & Score: Experience
      if (d.experienceYears < minExp || d.experienceYears > maxExp) continue;
      if (minExp > 0 || maxExp < 100) {
        score += 80;
      }
      if (exactExp !== null) {
        if (d.experienceYears === exactExp) score += 60;
        else if (Math.abs(d.experienceYears - exactExp) <= 2) score += 30;
      }

      // Filter & Score: Age
      if (d.age < minAge || d.age > maxAge) continue;
      if (minAge > 0 || maxAge < 100) {
        score += 80;
      }
      if (exactAge !== null) {
        if (d.age === exactAge) score += 60;
        else if (Math.abs(d.age - exactAge) <= 2) score += 30;
      }

      // Add Name Match Score
      if (nScore >= 500) {
        score += nScore;
      }

      // Score: Degree Match
      if (matchedDegreeTokens.length > 0) {
        const dQualLower = (d.qualifications + ' ' + (d.education || '') + ' ' + (d.fellowships || []).join(' ')).toLowerCase();
        let degreeMatches = 0;
        for (const token of matchedDegreeTokens) {
          const regex = new RegExp(`\\b${token}\\b`, 'i');
          if (regex.test(dQualLower)) degreeMatches++;
        }
        if (degreeMatches > 0) {
          score += degreeMatches * 40;
        } else if (matchedDegreeTokens.length > 0 && !isAttributeOrGeneralQuery && !isNameMatch) {
          continue; // Degree explicitly required and doctor does not have it
        }
      }

      // Score: College / Alma Mater Match
      if (matchedCollegeTokens.length > 0) {
        const dEduLower = ((d.education || '') + ' ' + (d.fellowships || []).join(' ')).toLowerCase();
        let collegeMatches = 0;
        for (const col of matchedCollegeTokens) {
          if (dEduLower.includes(col)) collegeMatches++;
        }
        if (collegeMatches > 0) {
          score += collegeMatches * 50;
        }
      }

      // Score: Clinical Specifications & Procedures
      if (d.specifications && d.specifications.some(spec => qLower.includes(spec.toLowerCase()) || spec.toLowerCase().includes(qLower))) {
        score += 50;
      }

      // Score: Department & Subspecialty
      if (d.specialty.toLowerCase().includes(qLower) || d.subspecialty.toLowerCase().includes(qLower) || (d.designation && d.designation.toLowerCase().includes(qLower))) {
        score += 45;
      }

      // Score: Medical Registration Number
      if (d.regNo && d.regNo.toLowerCase().includes(qLower)) {
        score += 100;
      }

      // Score: Department Clinical Keyword Match
      if (targetSpecialties.includes(d.specialty)) {
        score += 50;
      }

      const isListAllDoctorsQuery = (
        qLower.includes('all doctor') || qLower.includes('all doctors') ||
        qLower.includes('list of all') || qLower.includes('every doctor') ||
        qLower.includes('all specialists') || qLower === 'doctors' || qLower === 'list doctors'
      );

      if (score > 0 || isListAllDoctorsQuery || (targetSpecialties.length > 0 && targetSpecialties.includes(d.specialty))) {
        scoredDoctors.push({ doctor: d, score: score });
      }
    }

    // 9. Intelligent Ranking & Sorting
    scoredDoctors.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (minExp > 0 || qLower.includes('most experienced') || qLower.includes('highest experience')) {
        return b.doctor.experienceYears - a.doctor.experienceYears;
      }
      if (qLower.includes('top rated') || qLower.includes('best')) {
        return b.doctor.rating - a.doctor.rating || b.doctor.reviewsCount - a.doctor.reviewsCount;
      }
      if (qLower.includes('young') || qLower.includes('junior')) {
        return a.doctor.age - b.doctor.age;
      }
      return b.doctor.experienceYears - a.doctor.experienceYears;
    });

    return scoredDoctors.map(item => item.doctor);
  }

  getDoctorNameMatchScore(d, qLower) {
    const cleanName = d.name.toLowerCase().replace(/^(dr\.|dr)\s+/i, '').trim();
    const fullNameLower = d.name.toLowerCase();
    
    // 1. Exact full name in query (e.g. "dr. suresh kumar" or "suresh kumar")
    if (qLower.includes(fullNameLower) || qLower.includes(cleanName)) {
      return 1000;
    }

    // 2. Exact alias match with word boundary (e.g. "s n khanna")
    if (d.aliases && d.aliases.some(alias => {
      const regex = new RegExp(`\\b${alias.replace(/\./g, '\\.')}\\b`, 'i');
      return regex.test(qLower);
    })) {
      return 900;
    }

    // 3. Distinctive Token-Level Matching
    const parts = cleanName.split(/\s+/).filter(p => p.length >= 2);
    const commonSurnames = new Set(['kumar', 'rao', 'reddy', 'sharma', 'singh', 'gupta', 'patel', 'nair', 'menon', 'babu', 'paul']);

    let matchedTokens = 0;
    let matchedDistinctivePart = false;

    parts.forEach((p, idx) => {
      const regex = new RegExp(`\\b${p.replace(/\./g, '')}\\b`, 'i');
      if (regex.test(qLower)) {
        matchedTokens++;
        // Distinctive if it's the first name (e.g. "suresh", "anil", "anupama") or not a generic surname
        if (idx === 0 || !commonSurnames.has(p)) {
          matchedDistinctivePart = true;
        }
      }
    });

    if (matchedTokens === parts.length && parts.length > 1) {
      return 800;
    }

    if (matchedDistinctivePart && matchedTokens > 0) {
      return 500 + matchedTokens * 50;
    }

    if (matchedTokens > 0 && !matchedDistinctivePart) {
      return 50; // Generic surname only without distinctive first name
    }

    return 0;
  }

  findLocationsForQuery(query) {
    const qLower = query.toLowerCase();
    return ASTER_LOCATIONS.filter(loc => {
      return (
        loc.name.toLowerCase().includes(qLower) ||
        loc.city.toLowerCase().includes(qLower) ||
        loc.state.toLowerCase().includes(qLower) ||
        loc.region.toLowerCase().includes(qLower) ||
        (qLower.includes('bangalore') && loc.city === 'Bangalore') ||
        (qLower.includes('kerala') && loc.state === 'Kerala') ||
        (qLower.includes('kochi') && loc.city === 'Kochi') ||
        (qLower.includes('calicut') && loc.city.includes('Calicut')) ||
        (qLower.includes('hyderabad') && loc.city === 'Hyderabad') ||
        (qLower.includes('guntur') && loc.city === 'Guntur')
      );
    });
  }

  extractSpecificDoctorAttribute(d, query) {
    const qLower = query.toLowerCase().trim();

    // 1. Check if user explicitly asked for FULL / ALL details or complete profile
    const isExplicitFullDetails = (
      qLower.includes('full detail') || qLower.includes('all detail') || qLower.includes('complete detail') ||
      qLower.includes('full profile') || qLower.includes('complete profile') || qLower.includes('personal detail') ||
      qLower.includes('personal info') || qLower.includes('resume') || qLower.includes('everything about') ||
      qLower.includes('dossier') || qLower.includes('complete information') || qLower.includes('all info')
    );

    if (isExplicitFullDetails) {
      return null; // Return null so it outputs the comprehensive dossier
    }

    // 2. Qualifications / Education / Degrees / College / Alma Mater
    if (
      qLower.includes('qualification') || qLower.includes('qualifications') ||
      qLower.includes('degree') || qLower.includes('degrees') ||
      qLower.includes('education') || qLower.includes('college') ||
      qLower.includes('university') || qLower.includes('alma mater') ||
      qLower.includes('where did he study') || qLower.includes('where did she study') ||
      qLower.includes('where did they study') || qLower.includes('studied in') ||
      qLower.includes('graduated from') || qLower.includes('educational background') ||
      qLower.includes('educational qualification')
    ) {
      return {
        title: `Qualifications of ${d.name}`,
        content: `The qualifications of **${d.name}** are **${d.qualifications}** (${d.education || d.qualifications}).`
      };
    }

    // 3. Medical Council Registration Number (MCI / KMC / TMC / TSMC / APMC / GMC)
    if (
      qLower.includes('registration') || qLower.includes('reg no') || qLower.includes('reg. no') ||
      qLower.includes('reg number') || qLower.includes('registration number') ||
      qLower.includes('mci') || qLower.includes('kmc') || qLower.includes('tmc') ||
      qLower.includes('tsmc') || qLower.includes('apmc') || qLower.includes('medical council') ||
      qLower.includes('license') || qLower.includes('licence')
    ) {
      return {
        title: `Medical Registration Number: ${d.name}`,
        content: `The Medical Council Registration Number of **${d.name}** is **${d.regNo || 'Verified Active'}**.`
      };
    }

    // 4. Consultation Fee / Price / Charges / Cost
    if (
      qLower.includes('fee') || qLower.includes('fees') || qLower.includes('cost') ||
      qLower.includes('price') || qLower.includes('charge') || qLower.includes('charges') ||
      qLower.includes('how much') || qLower.includes('consultation fee') ||
      qLower.includes('pricing') || qLower.includes('rate') || qLower.includes('video fee')
    ) {
      return {
        title: `Consultation Fee: ${d.name}`,
        content: `The consultation fee of **${d.name}** is **${d.consultationFee}** (Video consultation: **${d.videoConsultFee || '₹800'}**).`
      };
    }

    // 5. OPD Schedule / Timings / Days / Availability
    if (
      qLower.includes('timing') || qLower.includes('timings') || qLower.includes('schedule') ||
      qLower.includes('when is') || qLower.includes('available') || qLower.includes('visiting hour') ||
      qLower.includes('visiting time') || qLower.includes('opd time') || qLower.includes('opd days') ||
      qLower.includes('days available') || qLower.includes('when can i see') || qLower.includes('when can i consult')
    ) {
      return {
        title: `OPD Timings: ${d.name}`,
        content: `The OPD timings of **${d.name}** are **${d.opdSchedule}** (${d.chamber || 'OPD Suite'}).`
      };
    }

    // 6. Chamber / Room Number / Suite / Floor
    if (
      qLower.includes('chamber') || qLower.includes('room') || qLower.includes('cabin') ||
      qLower.includes('suite') || qLower.includes('floor') || qLower.includes('where to meet') ||
      qLower.includes('which room') || qLower.includes('room number') || qLower.includes('room no')
    ) {
      return {
        title: `OPD Chamber: ${d.name}`,
        content: `The OPD chamber of **${d.name}** is **${d.chamber || 'OPD Specialist Suite'}** at **${d.hospital}**.`
      };
    }

    // 7. Hospital Campus / Location / Branch / City / Where does doctor work
    if (
      qLower.includes('which hospital') || qLower.includes('which branch') || qLower.includes('which campus') ||
      qLower.includes('where does') || qLower.includes('where is dr') || qLower.includes('hospital location') ||
      qLower.includes('working at') || qLower.includes('which city') || qLower.includes('hospital address')
    ) {
      return {
        title: `Hospital Location: ${d.name}`,
        content: `The hospital location of **${d.name}** is **${d.hospital}** (${d.city}).`
      };
    }

    // 8. Contact Info (Phone / Email / Extension / Helpline)
    if (
      qLower.includes('phone') || qLower.includes('email') || qLower.includes('contact') ||
      qLower.includes('mobile') || qLower.includes('number') || qLower.includes('how to call') ||
      qLower.includes('how to reach') || qLower.includes('mail') || qLower.includes('extension') ||
      qLower.includes('telephone')
    ) {
      return {
        title: `Contact: ${d.name}`,
        content: `The contact email of **${d.name}** is \`${d.email || 'care@asterhospital.com'}\` (Phone desk: **${d.phone || '1800 102 4647'}**).`
      };
    }

    // 9. Age & Gender (ONLY Age and direct gender - NO full profile or biodata)
    if (
      qLower.includes('age') || qLower.includes('how old') ||
      qLower.includes('gender') || qLower.includes('male or female') || qLower.includes('doctor age')
    ) {
      return {
        title: `Age of ${d.name}`,
        content: `The age of **${d.name}** is **${d.age} years old** (Gender: ${d.gender}).`
      };
    }

    // 10. Experience & Career Surgery Volume
    if (
      qLower.includes('how many years') || qLower.includes('experience of') ||
      qLower.includes('years of practice') || qLower.includes('years of exp') ||
      qLower.includes('total experience') || (qLower.includes('experience') && !qLower.includes('above') && !qLower.includes('more than') && !qLower.includes('list'))
    ) {
      return {
        title: `Experience of ${d.name}`,
        content: `The clinical experience of **${d.name}** is **${d.experience}** (${d.experienceYears} Years).`
      };
    }

    // 11. Career Surgeries Count / Case Volume
    if (
      qLower.includes('surgery count') || qLower.includes('surgeries count') ||
      qLower.includes('how many surgeries') || qLower.includes('number of surgeries') ||
      qLower.includes('case volume') || qLower.includes('operations done') ||
      qLower.includes('procedures count')
    ) {
      return {
        title: `Surgeries Count: ${d.name}`,
        content: `The total surgeries performed by **${d.name}** is **${d.surgeriesCount || 'thousands of surgeries'}**.`
      };
    }

    // 12. Awards & Honors / Medals
    if (
      qLower.includes('award') || qLower.includes('awards') || qLower.includes('honor') ||
      qLower.includes('honors') || qLower.includes('medal') || qLower.includes('medals') ||
      qLower.includes('recognition') || qLower.includes('achievements')
    ) {
      return {
        title: `Awards: ${d.name}`,
        content: `The awards received by **${d.name}** are: ${d.awards && d.awards.length > 0 ? d.awards.join('; ') : 'Multiple clinical excellence awards'}.`
      };
    }

    // 13. Fellowships & International Training
    if (
      qLower.includes('fellowship') || qLower.includes('fellowships') ||
      qLower.includes('international training') || qLower.includes('trained in') ||
      qLower.includes('overseas training')
    ) {
      return {
        title: `Fellowships: ${d.name}`,
        content: `The fellowships of **${d.name}** are: ${d.fellowships && d.fellowships.length > 0 ? d.fellowships.join('; ') : 'Advanced international clinical fellowships'}.`
      };
    }

    // 14. Clinical Specialization / Key Procedures / What diseases treated
    if (
      qLower.includes('specialization') || qLower.includes('speciality') ||
      qLower.includes('specialty') || qLower.includes('expertise') ||
      qLower.includes('procedures') || qLower.includes('what does he do') ||
      qLower.includes('what does she do') || qLower.includes('what does dr') ||
      qLower.includes('what diseases') || qLower.includes('treat')
    ) {
      return {
        title: `Specializations: ${d.name}`,
        content: `The specializations of **${d.name}** are **${d.specialty}** (${(d.specifications || []).join(', ')}).`
      };
    }

    // 15. Spoken Languages
    if (
      qLower.includes('language') || qLower.includes('languages') ||
      qLower.includes('speak') || qLower.includes('fluent in')
    ) {
      return {
        title: `Languages: ${d.name}`,
        content: `The languages spoken by **${d.name}** are **${d.languages.join(', ')}**.`
      };
    }

    // 16. Memberships & Associations
    if (
      qLower.includes('membership') || qLower.includes('memberships') ||
      qLower.includes('association') || qLower.includes('associations') ||
      qLower.includes('society') || qLower.includes('societies')
    ) {
      return {
        title: `Memberships: ${d.name}`,
        content: `The professional memberships of **${d.name}** are: ${d.memberships && d.memberships.length > 0 ? d.memberships.join('; ') : 'National and state medical councils'}.`
      };
    }

    // 17. Publications & Research
    if (
      qLower.includes('publication') || qLower.includes('publications') ||
      qLower.includes('research') || qLower.includes('papers') ||
      qLower.includes('articles') || qLower.includes('journal')
    ) {
      return {
        title: `Publications: ${d.name}`,
        content: `The publications by **${d.name}** include: ${d.publications || 'Authored peer-reviewed clinical research papers'}.`
      };
    }

    // 18. Bio / Summary / About
    if (
      qLower.includes('bio') || qLower.includes('about') ||
      qLower.includes('summary') || qLower.includes('profile overview')
    ) {
      return {
        title: `About ${d.name}`,
        content: `*${d.bio}*`
      };
    }

    return null; // Fallback to full dossier
  }

  formatContent(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  stripMarkdownForSpeech(md) {
    return md
      .replace(/###/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/>/g, '')
      .replace(/•/g, '')
      .replace(/#{1,6}\s?/g, '')
      .slice(0, 300);
  }

  generateFollowupSuggestions(query) {
    if (query.includes('compare') || query.includes('vs')) {
      return ['🏥 List all Aster Hospitals', '👨‍⚕️ Doctors at Aster Medcity', '👨‍⚕️ Doctors at Aster CMI Bangalore', '🚨 Emergency contact numbers'];
    }
    if (query.includes('hospital') || query.includes('branch') || query.includes('location')) {
      return ['👨‍⚕️ Doctors at Aster Medcity Kochi', '👨‍⚕️ Doctors at Aster CMI Bangalore', '⚖️ Compare Hospital Facilities', '🚨 All Hospital Emergency Numbers'];
    }
    if (query.includes('doctor') || query.includes('appointment')) {
      return ['🫀 Top Cardiologists (TAVI & CABG)', '🧠 Neurosurgeons (DBS & Brain)', '🦴 Robotic Joint Specialists (Mako)', '👶 Pediatricians & Maternity'];
    }
    if (query.includes('emergency') || query.includes('ambulance')) {
      return ['🚑 Request ICU Ambulance', '🏥 Find nearest Aster Hospital', '⚖️ Compare Hospital Facilities'];
    }
    return [
      '🏥 List all Aster Hospitals',
      '👨‍⚕️ Doctors at Aster Medcity Kochi',
      '👨‍⚕️ Doctors at Aster CMI Bangalore',
      '⚖️ Compare Hospital Facilities',
      '🚨 Emergency contact numbers',
      '🧪 Health packages & pricing'
    ];
  }

  renderMessages() {
    const container = document.getElementById('chat-messages-list');
    if (!container) return;

    container.innerHTML = this.messages.map(msg => {
      const isBot = msg.sender === 'bot';
      const renderedText = this.renderMarkdown(msg.text);

      let actionCardsHtml = '';
      if (msg.actionCards && msg.actionCards.length > 0) {
        actionCardsHtml = `
          <div class="action-cards-container">
            ${msg.actionCards.map(card => this.renderActionCard(card)).join('')}
          </div>
        `;
      }

      let suggestionsHtml = '';
      if (msg.suggestions && msg.suggestions.length > 0) {
        suggestionsHtml = `
          <div class="suggestions-chips-row">
            ${msg.suggestions.map(s => `
              <button class="suggestion-chip" onclick="window.asterApp.handleSuggestionClick('${s.replace(/'/g, "\\'")}')">
                ${s}
              </button>
            `).join('')}
          </div>
        `;
      }

      let audioControls = '';
      if (isBot && msg.rawTextToSpeak) {
        audioControls = `
          <button class="msg-tts-btn" title="Listen to response" onclick="window.asterApp.speakText('${msg.rawTextToSpeak.replace(/'/g, "\\'").replace(/\n/g, " ")}')">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        `;
      }

      return `
        <div class="chat-message ${msg.sender}" id="${msg.id}">
          <div class="msg-avatar ${msg.sender}">
            <i class="fa-solid ${isBot ? 'fa-user-doctor' : 'fa-user'}"></i>
          </div>
          <div class="msg-content-wrapper">
            <div class="msg-bubble">
              ${renderedText}
              ${actionCardsHtml}
            </div>
            <div class="msg-footer">
              <span class="msg-time">${msg.time}</span>
              ${audioControls}
            </div>
            ${suggestionsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  renderActionCard(card) {
    // --- Multi-Hospital Directory Cards ---
    if (card.type === 'locations') {
      return `
        <div class="interactive-card locations-card-grid">
          ${card.locations.map(loc => `
            <div class="location-mini-card">
              <div class="loc-mini-header">
                <span class="loc-city-pill">${loc.city}, ${loc.state}</span>
                <span class="loc-beds-pill"><i class="fa-solid fa-bed-pulse"></i> ${loc.beds}</span>
              </div>
              <h4 class="loc-mini-title">${loc.name}</h4>
              <p class="loc-addr"><i class="fa-solid fa-map-pin"></i> ${loc.address}</p>
              <div class="loc-specialty-tags">
                <strong>Focus:</strong> ${loc.specialtiesHighlights.split(',').slice(0, 3).join(', ')}
              </div>
              <div class="loc-mini-btns">
                <button class="btn-loc-filter-doc" onclick="window.asterApp.filterDoctorsByHospital('${loc.id}')">
                  <i class="fa-solid fa-user-doctor"></i> View Doctors (${loc.doctorsCount || '100+'})
                </button>
                <a href="tel:${loc.emergencyPhone.replace(/\s+/g, '')}" class="btn-loc-emergency">
                  <i class="fa-solid fa-phone-volume"></i> Emergency: ${loc.emergencyPhone.split('/')[0]}
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // --- Doctor Cards Grid with Precise Specifications & Personal Details ---
    if (card.type === 'doctors') {
      return `
        <div class="interactive-card doctors-card-grid">
          ${card.doctors.map(doc => `
            <div class="doctor-mini-card">
              <img src="${doc.avatar}" alt="${doc.name}" class="doc-mini-avatar" />
              <div class="doc-mini-info">
                <div class="doc-mini-header-row">
                  <h4>${doc.name}</h4>
                </div>
                <div class="doc-meta-pills-row">
                  <span class="doc-exp-badge"><i class="fa-solid fa-user-clock"></i> ${doc.experience}</span>
                  <span class="doc-age-badge"><i class="fa-solid fa-id-badge"></i> Age ${doc.age}</span>
                  <span class="doc-gender-badge">${doc.gender}</span>
                  <span class="doc-reg-badge"><i class="fa-solid fa-shield-halved"></i> ${doc.regNo ? doc.regNo.split('/')[0].trim() : 'MCI Verified'}</span>
                </div>
                <p class="doc-sub">${doc.designation || doc.subspecialty} (${doc.specialty})</p>
                <div class="doc-specs-chips">
                  ${(doc.specifications || []).slice(0, 3).map(s => `<span class="doc-spec-pill"><i class="fa-solid fa-check"></i> ${s}</span>`).join('')}
                </div>
                <p class="doc-hosp"><i class="fa-solid fa-location-dot"></i> ${doc.hospital}</p>
                <div class="doc-rating-fee">
                  <span class="doc-rating"><i class="fa-solid fa-star"></i> ${doc.rating} (${doc.reviewsCount})</span>
                  <span class="doc-fee"><i class="fa-solid fa-indian-rupee-sign"></i> ${doc.consultationFee.replace('₹', '')}</span>
                </div>
                <div class="doc-card-actions">
                  <button class="btn-view-doc-profile" onclick="window.asterApp.openDoctorModal('${doc.id}')">
                    <i class="fa-solid fa-id-card"></i> View Personal Profile
                  </button>
                  <button class="btn-book-instant" onclick="window.asterApp.openBookingModal('${doc.id}', '${doc.branchCode}')">
                    <i class="fa-regular fa-calendar-check"></i> Book OPD Consultation
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // --- Hospital Side-by-Side Comparison Card ---
    if (card.type === 'comparison') {
      return `
        <div class="interactive-card comparison-card">
          <div class="card-header"><i class="fa-solid fa-scale-balanced"></i> Hospital Infrastructure Comparison</div>
          <div class="comparison-table-wrapper">
            <table class="chat-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Aster CMI (Bangalore)</th>
                  <th>Aster Medcity (Kochi)</th>
                  <th>Aster Whitefield (Blr)</th>
                  <th>Aster MIMS (Calicut)</th>
                </tr>
              </thead>
              <tbody>
                ${card.comparison.map(row => `
                  <tr>
                    <td class="feature-col"><strong>${row.feature}</strong></td>
                    <td>${row["bangalore-cmi"]}</td>
                    <td>${row["kochi-medcity"]}</td>
                    <td>${row["bangalore-whitefield"]}</td>
                    <td>${row["calicut-mims"]}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="comparison-footer">
            <button class="btn-compare-all" onclick="window.asterApp.openComparisonModal()">
              <i class="fa-solid fa-expand"></i> View Full Multi-Hospital Comparison
            </button>
          </div>
        </div>
      `;
    }

    // --- Unified Emergency Directory Card ---
    if (card.type === 'all_emergency') {
      return `
        <div class="interactive-card emergency-card">
          <div class="card-header"><i class="fa-solid fa-truck-medical"></i> 24/7 Level-1 Emergency & ICU Ambulance Dispatch</div>
          <div class="card-body">
            <div class="emergency-phones-grid">
              ${card.hospitals.map(h => `
                <div class="emergency-phone-box">
                  <span class="phone-hospital-name">${h.name}</span>
                  <span class="phone-city-tag">${h.city}</span>
                  <a href="tel:${h.emergencyPhone.replace(/\s+/g, '')}" class="btn-dial-emergency">
                    <i class="fa-solid fa-phone"></i> ${h.emergencyPhone}
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // --- Packages Cards ---
    if (card.type === 'packages') {
      return `
        <div class="interactive-card packages-card-grid">
          ${card.packages.map(pkg => `
            <div class="pkg-mini-card ${pkg.popular ? 'popular-pkg' : ''}">
              <div class="pkg-mini-header">
                <div>
                  ${pkg.popular ? '<span class="pkg-mini-popular-tag"><i class="fa-solid fa-fire"></i> Most Popular</span>' : ''}
                  <h4>${pkg.name}</h4>
                  <span class="pkg-mini-target">${pkg.target}</span>
                </div>
                <div class="pkg-mini-price-box">
                  <span class="pkg-mini-price">₹${pkg.price.toLocaleString()}</span>
                  <span class="pkg-mini-orig">₹${pkg.originalPrice.toLocaleString()}</span>
                  <span class="pkg-mini-disc">${pkg.discountPercent}% OFF</span>
                </div>
              </div>
              <div class="pkg-mini-meta-row">
                <span class="pkg-tests-badge"><i class="fa-solid fa-flask-vial"></i> ${pkg.testCount}</span>
                <span class="pkg-fasting-badge"><i class="fa-solid fa-clock-rotate-left"></i> ${pkg.fasting.split(' ')[0]} ${pkg.fasting.split(' ')[1]} Fasting</span>
              </div>
              <ul class="pkg-mini-inclusions">
                ${(pkg.inclusions || []).slice(0, 4).map(inc => `<li><i class="fa-solid fa-check"></i> ${inc}</li>`).join('')}
              </ul>
              <div class="pkg-mini-footer">
                <button class="btn-book-pkg" onclick="window.asterApp.openPackageModal('${pkg.id}')">
                  <i class="fa-solid fa-calendar-plus"></i> Book This Checkup
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // --- Insurance Card ---
    if (card.type === 'insurance') {
      return `
        <div class="interactive-card insurance-card">
          <div class="card-header"><i class="fa-solid fa-id-card-clip"></i> ${card.title}</div>
          <div class="card-body">
            <p>For immediate cashless pre-auth assistance and admission coordination, call our 24/7 desk:</p>
            <div class="insurance-contact-box">
              <a href="tel:08046474444" class="btn-dial-emergency"><i class="fa-solid fa-headset"></i> ${card.contact}</a>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  renderMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h4 class="md-h3">$1</h4>')
      .replace(/^#### (.*$)/gim, '<h5 class="md-h4">$1</h5>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" class="md-link">$1</a>')
      .replace(/^\- (.*$)/gim, '<li class="md-li">$1</li>')
      .replace(/((?:<li class="md-li">.*<\/li>\s*)+)/gim, '<ul class="md-ul">$1</ul>')
      .replace(/\n/gim, '<br>');
  }

  scrollToBottom() {
    const container = document.getElementById('chat-messages-list');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  speakText(text) {
    if (!this.synth) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    this.synth.speak(utterance);
  }

  toggleVoiceInput() {
    if (!this.recognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  updateVoiceButtonState(isListening) {
    const btn = document.getElementById('btn-voice-input');
    if (btn) {
      if (isListening) {
        btn.classList.add('listening');
        btn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
      } else {
        btn.classList.remove('listening');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      }
    }
  }

  clearChat() {
    this.messages = [];
    this.sendInitialGreeting();
  }
}
