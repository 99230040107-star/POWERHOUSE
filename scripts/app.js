/**
 * Aster Hospitals Web Platform Main Application
 * Connects UI, Multi-Hospital Directory, Autonomous Crawler, BM25 Indexer, and AI Chatbot
 */

import { ASTER_WEBSITE_PAGES, ASTER_DOCTORS, ASTER_SPECIALTIES, ASTER_LOCATIONS, ASTER_HEALTH_PACKAGES, HOSPITAL_FACILITIES_COMPARISON } from './data.js';
import { WebCrawler } from './crawler.js';
import { SearchIndexer } from './indexer.js';
import { AsterChatbot } from './chatbot.js';

class AsterApp {
  constructor() {
    this.crawler = new WebCrawler();
    this.indexer = new SearchIndexer();
    this.chatbot = null;
    this.currentLocation = 'bangalore-cmi';
    this.selectedSpecialty = 'all';
    this.selectedBranch = 'all';
    this.selectedRegion = 'all';

    this.init();
  }

  async init() {
    console.log('Initializing Aster Hospitals Multi-Hospital Portal...');
    
    // Initialize Chatbot instance
    this.chatbot = new AsterChatbot(this.crawler, this.indexer);

    // Render static components
    this.renderSpecialties();
    this.renderDoctors();
    this.renderLocations();
    this.renderHealthPackages();
    this.renderComparisonTable();
    this.populateBookingDoctors();
    this.setupEventListeners();

    // Run autonomous crawler & indexer on load
    await this.runInitialCrawlAndIndex();
  }

  async runInitialCrawlAndIndex() {
    const crawlerBadge = document.getElementById('crawler-status-indicator');
    if (crawlerBadge) {
      crawlerBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Crawling 8 hospital campuses...';
      crawlerBadge.className = 'crawler-status crawling';
    }

    const { chunks } = await this.crawler.crawlWebsite();
    const indexStats = this.indexer.buildIndex(chunks);
    console.log('Semantic Inverted Index Built across 8 Hospital Campuses:', indexStats);

    if (crawlerBadge) {
      crawlerBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${this.crawler.crawledPages.size} Hospital Pages Indexed`;
      crawlerBadge.className = 'crawler-status active';
    }

    // Update bottom-right chatbot status
    const botStatus = document.getElementById('bot-header-status');
    if (botStatus) {
      botStatus.innerHTML = `<span class="status-dot"></span> Online • 8 Campuses (${this.crawler.crawledPages.size} Pages)`;
    }
  }

  renderSpecialties() {
    const grid = document.getElementById('specialties-grid');
    if (!grid) return;

    grid.innerHTML = ASTER_SPECIALTIES.map(s => `
      <div class="specialty-card" style="--accent-color: ${s.color}" onclick="window.asterApp.handleSpecialtyClick('${s.id}')">
        <div class="specialty-icon-box">
          <i class="${s.icon}"></i>
        </div>
        <div class="specialty-body">
          <div class="specialty-header">
            <h3>${s.name}</h3>
            ${s.emergencySupported ? '<span class="badge-247"><i class="fa-solid fa-bolt"></i> 24/7 Care</span>' : ''}
          </div>
          <p class="specialty-summary">${s.summary}</p>
          <div class="specialty-tags">
            ${s.procedures.slice(0, 3).map(p => `<span class="procedure-tag">${p}</span>`).join('')}
          </div>
          <div class="specialty-footer">
            <span class="lead-doc"><i class="fa-solid fa-user-doctor"></i> ${s.leadDoctor}</span>
            <span class="learn-more">Explore <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderDoctors(filteredDoctors = null) {
    const grid = document.getElementById('doctors-grid');
    if (!grid) return;

    const list = filteredDoctors || ASTER_DOCTORS;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="no-results-box">
          <i class="fa-solid fa-user-slash"></i>
          <p>No specialists found matching your search criteria.</p>
          <button class="btn-primary" onclick="window.asterApp.resetDoctorFilters()">Show All Doctors</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(doc => `
      <div class="doctor-card">
        <div class="doctor-card-top">
          <img src="${doc.avatar}" alt="${doc.name}" class="doctor-avatar" />
          <div class="doctor-badges">
            <span class="rating-badge"><i class="fa-solid fa-star"></i> ${doc.rating} (${doc.reviewsCount})</span>
            ${doc.availableToday ? '<span class="available-badge"><i class="fa-solid fa-circle"></i> Today</span>' : ''}
          </div>
        </div>
        <div class="doctor-card-body">
          <div class="doctor-title-row">
            <h3 class="doctor-name">${doc.name}</h3>
            <span class="doctor-exp-pill"><i class="fa-solid fa-user-clock"></i> ${doc.experience}</span>
          </div>
          <div class="doctor-sub-meta-row">
            <span class="doctor-age-tag"><i class="fa-solid fa-id-badge"></i> Age: ${doc.age} yrs</span>
            <span class="doctor-gender-tag">${doc.gender}</span>
            <span class="doctor-reg-tag"><i class="fa-solid fa-shield-halved"></i> ${doc.regNo ? doc.regNo.split('/')[0].trim() : 'MCI Verified'}</span>
          </div>
          <p class="doctor-specialty">${doc.specialty}</p>
          <p class="doctor-subspecialty">${doc.designation || doc.subspecialty}</p>
          
          <div class="doctor-specifications-container">
            <span class="specs-title"><i class="fa-solid fa-stethoscope"></i> Key Clinical Expertise:</span>
            <div class="doctor-specs-chips-list">
              ${(doc.specifications || []).slice(0, 4).map(s => `<span class="doctor-spec-tag"><i class="fa-solid fa-check"></i> ${s}</span>`).join('')}
            </div>
          </div>

          <div class="doctor-meta">
            <span><i class="fa-solid fa-graduation-cap"></i> ${doc.education || doc.qualifications}</span>
          </div>
          <div class="doctor-hospital-badge">
            <i class="fa-solid fa-hospital"></i> ${doc.hospital} (${doc.chamber || 'OPD Suite'})
          </div>
          <div class="doctor-languages">
            <i class="fa-solid fa-language"></i> Speaks: ${doc.languages.join(', ')}
          </div>
          <div class="doctor-schedule">
            <i class="fa-regular fa-clock"></i> OPD: ${doc.opdSchedule}
          </div>
        </div>
        <div class="doctor-card-footer">
          <div class="fee-box">
            <span class="fee-label">Consultation Fee</span>
            <span class="fee-val">${doc.consultationFee}</span>
          </div>
          <div class="doctor-card-buttons-group">
            <button class="btn-view-doc-profile" onclick="window.asterApp.openDoctorModal('${doc.id}')">
              <i class="fa-solid fa-id-card"></i> Personal Profile
            </button>
            <button class="btn-book-doctor" onclick="window.asterApp.openBookingModal('${doc.id}', '${doc.branchCode}')">
              <i class="fa-regular fa-calendar-check"></i> Book OPD
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderLocations(filteredLocations = null) {
    const grid = document.getElementById('locations-grid');
    if (!grid) return;

    const list = filteredLocations || ASTER_LOCATIONS;

    grid.innerHTML = list.map(loc => `
      <div class="location-card ${loc.id === this.currentLocation ? 'active-location' : ''}">
        <div class="loc-card-header">
          <div>
            <span class="loc-city-tag">${loc.city}, ${loc.state}</span>
            <h3>${loc.name}</h3>
          </div>
          <div class="loc-badges-group">
            <span class="loc-beds-badge"><i class="fa-solid fa-bed"></i> ${loc.beds}</span>
            <span class="loc-accred-badge">${loc.accreditation.split('&')[0].trim()}</span>
          </div>
        </div>
        <div class="loc-card-body">
          <p class="loc-address"><i class="fa-solid fa-map-location-dot"></i> ${loc.address}</p>
          <div class="loc-highlights">
            <strong>Key Focus:</strong> ${loc.specialtiesHighlights}
          </div>
          <div class="loc-facilities-chips">
            ${(loc.facilities || []).slice(0, 3).map(f => `<span class="facility-chip"><i class="fa-solid fa-check"></i> ${f}</span>`).join('')}
          </div>
          <div class="loc-contacts">
            <div class="contact-item emergency">
              <span class="contact-lbl">24/7 Emergency Dispatch</span>
              <a href="tel:${loc.emergencyPhone.replace(/\s+/g, '')}" class="contact-val">
                <i class="fa-solid fa-phone-volume"></i> ${loc.emergencyPhone}
              </a>
            </div>
            <div class="contact-item appointments">
              <span class="contact-lbl">Appointment Helpline</span>
              <a href="tel:${loc.appointmentPhone.replace(/\s+/g, '')}" class="contact-val">
                <i class="fa-solid fa-calendar-check"></i> ${loc.appointmentPhone}
              </a>
            </div>
          </div>
        </div>
        <div class="loc-card-footer">
          <button class="btn-filter-campus-docs" onclick="window.asterApp.filterDoctorsByHospital('${loc.id}')">
            <i class="fa-solid fa-user-doctor"></i> View Doctors in this Campus
          </button>
          <button class="btn-ask-bot-hosp" onclick="window.asterApp.askBotAboutHospital('${loc.name.replace(/'/g, "\\'")}')">
            <i class="fa-solid fa-robot"></i> Ask Bot
          </button>
        </div>
      </div>
    `).join('');
  }

  renderHealthPackages() {
    const grid = document.getElementById('packages-grid');
    if (!grid) return;

    grid.innerHTML = ASTER_HEALTH_PACKAGES.map(pkg => `
      <div class="package-card ${pkg.popular ? 'popular' : ''}">
        ${pkg.popular ? '<div class="popular-tag"><i class="fa-solid fa-fire"></i> Most Popular</div>' : ''}
        <div class="package-header">
          <span class="pkg-target">${pkg.target}</span>
          <h3>${pkg.name}</h3>
          <p class="pkg-desc">${pkg.description}</p>
          <div class="pkg-pricing">
            <span class="pkg-price">₹${pkg.price.toLocaleString()}</span>
            <span class="pkg-original">₹${pkg.originalPrice.toLocaleString()}</span>
            <span class="pkg-discount">${pkg.discountPercent}% OFF</span>
          </div>
        </div>
        <div class="package-body">
          <div class="pkg-meta-row">
            <span class="pkg-test-count"><i class="fa-solid fa-flask-vial"></i> ${pkg.testCount}</span>
            <span class="pkg-fasting-tag"><i class="fa-solid fa-clock-rotate-left"></i> ${pkg.fasting}</span>
          </div>
          <ul class="pkg-inclusions-list">
            ${pkg.inclusions.map(inc => `<li><i class="fa-solid fa-circle-check"></i> ${inc}</li>`).join('')}
          </ul>
        </div>
        <div class="package-footer">
          <button class="btn-book-package" onclick="window.asterApp.openPackageModal('${pkg.id}')">
            <i class="fa-regular fa-calendar-plus"></i> Book Health Checkup
          </button>
        </div>
      </div>
    `).join('');
  }

  renderComparisonTable() {
    const tbody = document.getElementById('comparison-table-body');
    if (!tbody) return;

    tbody.innerHTML = HOSPITAL_FACILITIES_COMPARISON.map(row => `
      <tr>
        <td class="feature-name"><strong>${row.feature}</strong></td>
        <td>${row["bangalore-cmi"]}</td>
        <td>${row["kochi-medcity"]}</td>
        <td>${row["bangalore-whitefield"]}</td>
        <td>${row["calicut-mims"]}</td>
        <td>${row["hyderabad-prime"]}</td>
      </tr>
    `).join('');
  }

  filterLocationsByRegion(region) {
    this.selectedRegion = region;
    
    // Update active tab styling
    document.querySelectorAll('.city-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-region') === region) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (region === 'all') {
      this.renderLocations(ASTER_LOCATIONS);
    } else {
      const filtered = ASTER_LOCATIONS.filter(l => l.region === region || l.city === region || l.state === region);
      this.renderLocations(filtered);
    }
  }

  filterDoctorsByHospital(branchId) {
    this.selectedBranch = branchId;
    
    // Update dropdown
    const branchSelect = document.getElementById('doctor-branch-filter');
    if (branchSelect) branchSelect.value = branchId;

    // Update chips
    document.querySelectorAll('.hospital-chip').forEach(chip => {
      if (chip.getAttribute('data-branch') === branchId) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    this.filterDoctors();

    // Scroll to doctors section smoothly
    const docSection = document.getElementById('doctors');
    if (docSection) {
      docSection.scrollIntoView({ behavior: 'smooth' });
    }

    const loc = ASTER_LOCATIONS.find(l => l.id === branchId);
    if (loc) {
      this.showToast(`Showing doctors at ${loc.name}`);
    }
  }

  setupEventListeners() {
    // Chatbot Trigger Button Click
    const triggerBtn = document.getElementById('chatbot-trigger-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.chatbot.toggleChat();
      });
    }

    // Chat Input Enter Key
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.chatbot.handleSendMessage();
        }
      });
    }

    // Doctor Search Filtering
    const docSearchInput = document.getElementById('doctor-search-input');
    if (docSearchInput) {
      docSearchInput.addEventListener('input', () => this.filterDoctors());
    }

    const docSpecialtySelect = document.getElementById('doctor-specialty-filter');
    if (docSpecialtySelect) {
      docSpecialtySelect.addEventListener('change', () => this.filterDoctors());
    }

    const docBranchSelect = document.getElementById('doctor-branch-filter');
    if (docBranchSelect) {
      docBranchSelect.addEventListener('change', (e) => {
        this.selectedBranch = e.target.value;
        // Sync chip
        document.querySelectorAll('.hospital-chip').forEach(chip => {
          if (chip.getAttribute('data-branch') === this.selectedBranch) {
            chip.classList.add('active');
          } else {
            chip.classList.remove('active');
          }
        });
        this.filterDoctors();
      });
    }

    const docExpSelect = document.getElementById('doctor-experience-filter');
    if (docExpSelect) {
      docExpSelect.addEventListener('change', () => this.filterDoctors());
    }

    const docGenderSelect = document.getElementById('doctor-gender-filter');
    if (docGenderSelect) {
      docGenderSelect.addEventListener('change', () => this.filterDoctors());
    }

    const docSortSelect = document.getElementById('doctor-sort-filter');
    if (docSortSelect) {
      docSortSelect.addEventListener('change', () => this.filterDoctors());
    }

    // Doctor Hospital Chips Click
    document.querySelectorAll('.hospital-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const branch = chip.getAttribute('data-branch');
        this.selectedBranch = branch;
        const branchSelect = document.getElementById('doctor-branch-filter');
        if (branchSelect) branchSelect.value = branch;

        document.querySelectorAll('.hospital-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filterDoctors();
      });
    });

    // Appointment Form Submission
    const bookingForm = document.getElementById('appointment-modal-form');
    if (bookingForm) {
      bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleBookingSubmit();
      });
    }
  }

  filterDoctors() {
    const searchVal = (document.getElementById('doctor-search-input')?.value || '').toLowerCase().trim();
    const specialtyVal = document.getElementById('doctor-specialty-filter')?.value || 'all';
    const branchVal = document.getElementById('doctor-branch-filter')?.value || 'all';
    const expVal = document.getElementById('doctor-experience-filter')?.value || 'all';
    const genderVal = document.getElementById('doctor-gender-filter')?.value || 'all';
    const sortVal = document.getElementById('doctor-sort-filter')?.value || 'featured';

    let filtered = ASTER_DOCTORS.filter(d => {
      const matchSearch = !searchVal || 
        d.name.toLowerCase().includes(searchVal) || 
        (d.aliases && d.aliases.some(a => a.toLowerCase().includes(searchVal))) ||
        d.specialty.toLowerCase().includes(searchVal) ||
        d.subspecialty.toLowerCase().includes(searchVal) ||
        (d.designation && d.designation.toLowerCase().includes(searchVal)) ||
        (d.specifications && d.specifications.some(s => s.toLowerCase().includes(searchVal))) ||
        d.qualifications.toLowerCase().includes(searchVal) ||
        (d.education && d.education.toLowerCase().includes(searchVal)) ||
        (d.regNo && d.regNo.toLowerCase().includes(searchVal)) ||
        (d.chamber && d.chamber.toLowerCase().includes(searchVal)) ||
        (d.email && d.email.toLowerCase().includes(searchVal)) ||
        d.hospital.toLowerCase().includes(searchVal) ||
        d.city.toLowerCase().includes(searchVal) ||
        (searchVal.includes('exp') && d.experienceYears >= parseInt(searchVal, 10)) ||
        (searchVal.includes('female') && d.gender === 'Female') ||
        (searchVal.includes('male') && !searchVal.includes('female') && d.gender === 'Male');

      const matchSpecialty = specialtyVal === 'all' || d.specialty === specialtyVal;
      const matchBranch = branchVal === 'all' || d.branchCode === branchVal;
      const matchExp = expVal === 'all' || d.experienceYears >= parseInt(expVal, 10);
      const matchGender = genderVal === 'all' || d.gender === genderVal;

      return matchSearch && matchSpecialty && matchBranch && matchExp && matchGender;
    });

    // Sort
    if (sortVal === 'experience-high') {
      filtered.sort((a, b) => b.experienceYears - a.experienceYears);
    } else if (sortVal === 'rating-high') {
      filtered.sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
    } else if (sortVal === 'fee-low') {
      filtered.sort((a, b) => a.feeAmount - b.feeAmount);
    } else if (sortVal === 'fee-high') {
      filtered.sort((a, b) => b.feeAmount - a.feeAmount);
    }

    this.renderDoctors(filtered);
  }

  resetDoctorFilters() {
    const sInput = document.getElementById('doctor-search-input');
    const sSelect = document.getElementById('doctor-specialty-filter');
    const bSelect = document.getElementById('doctor-branch-filter');
    const eSelect = document.getElementById('doctor-experience-filter');
    const gSelect = document.getElementById('doctor-gender-filter');
    const sortSelect = document.getElementById('doctor-sort-filter');
    if (sInput) sInput.value = '';
    if (sSelect) sSelect.value = 'all';
    if (bSelect) bSelect.value = 'all';
    if (eSelect) eSelect.value = 'all';
    if (gSelect) gSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'featured';
    
    document.querySelectorAll('.hospital-chip').forEach(c => {
      if (c.getAttribute('data-branch') === 'all') c.classList.add('active');
      else c.classList.remove('active');
    });

    this.renderDoctors();
  }

  handleSpecialtyClick(specialtyId) {
    const spec = ASTER_SPECIALTIES.find(s => s.id === specialtyId);
    if (!spec) return;

    this.chatbot.toggleChat(true);
    this.chatbot.processUserQuery(`Tell me about ${spec.name} department and specialists across hospitals`);
  }

  askBotAboutHospital(hospitalName) {
    this.chatbot.toggleChat(true);
    this.chatbot.processUserQuery(`Tell me about ${hospitalName} doctors, services, and emergency hotlines`);
  }

  handleSuggestionClick(suggestionText) {
    this.chatbot.processUserQuery(suggestionText);
  }

  speakText(text) {
    this.chatbot.speakText(text);
  }

  openDoctorModal(doctorId) {
    const doc = ASTER_DOCTORS.find(d => d.id === doctorId);
    if (!doc) return;

    const modal = document.getElementById('doctor-details-modal');
    const body = document.getElementById('doctor-details-modal-body');
    const footer = document.getElementById('doctor-details-modal-footer');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="doc-profile-header-card">
        <img src="${doc.avatar}" alt="${doc.name}" class="doc-profile-avatar" />
        <div class="doc-profile-main-info">
          <div class="doc-profile-name-row">
            <h2>${doc.name}</h2>
            <span class="doc-verified-badge"><i class="fa-solid fa-circle-check"></i> Verified Specialist</span>
          </div>
          <p class="doc-profile-designation">${doc.designation || doc.subspecialty}</p>
          <p class="doc-profile-dept"><i class="fa-solid fa-stethoscope"></i> ${doc.specialty}</p>
          <p class="doc-profile-campus"><i class="fa-solid fa-hospital"></i> ${doc.hospital}</p>
          
          <div class="doc-profile-pill-tags">
            <span class="profile-pill exp-pill"><i class="fa-solid fa-user-clock"></i> ${doc.experience} Experience</span>
            <span class="profile-pill age-pill"><i class="fa-solid fa-id-badge"></i> Age: ${doc.age} yrs (${doc.gender})</span>
            <span class="profile-pill reg-pill"><i class="fa-solid fa-shield-halved"></i> ${doc.regNo || 'Medical Council Registered'}</span>
            <span class="profile-pill rating-pill"><i class="fa-solid fa-star"></i> ${doc.rating} (${doc.reviewsCount} Patient Reviews)</span>
          </div>
        </div>
      </div>

      <div class="doc-profile-grid-sections">
        <!-- Section 1: Academic & Professional Credentials -->
        <div class="profile-section-card">
          <h4><i class="fa-solid fa-graduation-cap"></i> Academic Qualifications & Fellowships</h4>
          <div class="profile-info-item">
            <strong>Degrees & Institutes:</strong>
            <p>${doc.education || doc.qualifications}</p>
          </div>
          ${doc.fellowships && doc.fellowships.length > 0 ? `
            <div class="profile-info-item">
              <strong>Fellowships & Advanced Training:</strong>
              <ul class="profile-list-bullets">
                ${doc.fellowships.map(f => `<li><i class="fa-solid fa-award"></i> ${f}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${doc.memberships && doc.memberships.length > 0 ? `
            <div class="profile-info-item">
              <strong>Professional Memberships:</strong>
              <p>${doc.memberships.join(' • ')}</p>
            </div>
          ` : ''}
        </div>

        <!-- Section 2: Clinical Experience & Procedures -->
        <div class="profile-section-card">
          <h4><i class="fa-solid fa-notes-medical"></i> Clinical Specializations & Procedures</h4>
          <div class="profile-info-item">
            <strong>Career Surgeries & Volume:</strong>
            <p class="highlight-stat"><i class="fa-solid fa-heart-pulse"></i> ${doc.surgeriesCount || 'Multi-thousand successful clinical cases'}</p>
          </div>
          <div class="profile-info-item">
            <strong>Key Procedures & Areas of Expertise:</strong>
            <div class="profile-specs-cloud">
              ${(doc.specifications || []).map(s => `<span class="profile-spec-tag"><i class="fa-solid fa-check-circle"></i> ${s}</span>`).join('')}
            </div>
          </div>
          ${doc.publications ? `
            <div class="profile-info-item">
              <strong>Research & Publications:</strong>
              <p><i class="fa-solid fa-book-medical"></i> ${doc.publications}</p>
            </div>
          ` : ''}
        </div>

        <!-- Section 3: Honors, Awards & Recognition -->
        ${doc.awards && doc.awards.length > 0 ? `
          <div class="profile-section-card full-span">
            <h4><i class="fa-solid fa-trophy"></i> Awards & National Honors</h4>
            <div class="awards-chips-container">
              ${doc.awards.map(a => `<span class="award-chip"><i class="fa-solid fa-medal"></i> ${a}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Section 4: OPD Schedule, Chamber & Contact Details -->
        <div class="profile-section-card full-span">
          <h4><i class="fa-solid fa-clock"></i> OPD Schedule, Chamber & Contact Details</h4>
          <div class="opd-contact-grid">
            <div class="opd-item">
              <span class="opd-lbl">OPD Timings:</span>
              <span class="opd-val"><i class="fa-regular fa-clock"></i> ${doc.opdSchedule}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Consultation Chamber:</span>
              <span class="opd-val"><i class="fa-solid fa-door-open"></i> ${doc.chamber || 'OPD Specialist Chamber'}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">OPD In-Person Fee:</span>
              <span class="opd-val fee-highlight">${doc.consultationFee}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Video Consultation Fee:</span>
              <span class="opd-val fee-highlight">${doc.videoConsultFee || '₹800'}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Languages Spoken:</span>
              <span class="opd-val"><i class="fa-solid fa-language"></i> ${doc.languages.join(', ')}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Official Email:</span>
              <span class="opd-val"><i class="fa-solid fa-envelope"></i> <a href="mailto:${doc.email || 'care@asterhospital.com'}">${doc.email || 'care@asterhospital.com'}</a></span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Direct Desk Helpline:</span>
              <span class="opd-val"><i class="fa-solid fa-phone"></i> ${doc.phone || '080-4647 4444'}</span>
            </div>
            <div class="opd-item">
              <span class="opd-lbl">Medical Registration:</span>
              <span class="opd-val"><i class="fa-solid fa-shield-halved"></i> <code>${doc.regNo || 'MCI / State Medical Council Registered'}</code></span>
            </div>
          </div>
        </div>

        <!-- Section 5: Biography Overview -->
        <div class="profile-section-card full-span">
          <h4><i class="fa-solid fa-user-doctor"></i> About ${doc.name}</h4>
          <p class="profile-bio-text">${doc.bio}</p>
        </div>
      </div>
    `;

    if (footer) {
      footer.innerHTML = `
        <button type="button" class="btn-outline" onclick="window.asterApp.closeDoctorModal()">Close</button>
        <button type="button" class="btn-secondary" onclick="window.asterApp.askBotAboutDoctor('${doc.name.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-robot"></i> Ask AI Bot About Doctor
        </button>
        <button type="button" class="btn-primary" onclick="window.asterApp.closeDoctorModal(); window.asterApp.openBookingModal('${doc.id}', '${doc.branchCode}')">
          <i class="fa-regular fa-calendar-check"></i> Book OPD Consultation (${doc.consultationFee})
        </button>
      `;
    }

    modal.classList.add('active');
  }

  closeDoctorModal() {
    const modal = document.getElementById('doctor-details-modal');
    if (modal) modal.classList.remove('active');
  }

  askBotAboutDoctor(doctorName) {
    this.closeDoctorModal();
    this.chatbot.toggleChat(true);
    this.chatbot.processUserQuery(`Tell me full personal details, qualifications, experience, and OPD timings of ${doctorName}`);
  }

  openBookingModal(doctorId = null, hospitalId = null) {
    const modal = document.getElementById('appointment-modal');
    if (!modal) return;

    const hospSelect = document.getElementById('modal-hospital-select');
    const docSelect = document.getElementById('modal-doctor-select');
    const specialtySelect = document.getElementById('modal-specialty-select');

    if (hospitalId && hospSelect) {
      hospSelect.value = hospitalId;
    }

    if (doctorId && docSelect) {
      const doc = ASTER_DOCTORS.find(d => d.id === doctorId);
      if (doc) {
        if (hospSelect) hospSelect.value = doc.branchCode;
        if (specialtySelect) specialtySelect.value = doc.specialty;
      }
    }

    this.populateBookingDoctors();

    if (doctorId && docSelect) {
      docSelect.value = doctorId;
    }

    modal.classList.add('active');
  }

  closeBookingModal() {
    const modal = document.getElementById('appointment-modal');
    if (modal) modal.classList.remove('active');
  }

  openComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    if (modal) modal.classList.add('active');
  }

  closeComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    if (modal) modal.classList.remove('active');
  }

  handleModalHospitalChange() {
    this.populateBookingDoctors();
  }

  handleModalSpecialtyChange() {
    this.populateBookingDoctors();
  }

  populateBookingDoctors() {
    const docSelect = document.getElementById('modal-doctor-select');
    const hospSelect = document.getElementById('modal-hospital-select');
    const specialtySelect = document.getElementById('modal-specialty-select');
    if (!docSelect) return;

    const selectedHosp = hospSelect ? hospSelect.value : 'all';
    const selectedSpec = specialtySelect ? specialtySelect.value : 'all';

    const matchingDocs = ASTER_DOCTORS.filter(d => {
      const matchHosp = selectedHosp === 'all' || d.branchCode === selectedHosp;
      const matchSpec = selectedSpec === 'all' || d.specialty === selectedSpec;
      return matchHosp && matchSpec;
    });

    if (matchingDocs.length === 0) {
      docSelect.innerHTML = `<option value="">No specialists for this combination - Choose General Consultant</option>`;
      return;
    }

    docSelect.innerHTML = matchingDocs.map(d => `
      <option value="${d.id}">${d.name} [${d.subspecialty}] - ${d.hospital.split(',')[0]}</option>
    `).join('');
  }

  handleHeroBranchChange() {
    // Optional sync
  }

  handleHeroQuickBook() {
    const branch = document.getElementById('hero-quick-branch')?.value;
    const specialty = document.getElementById('hero-quick-specialty')?.value;
    this.openBookingModal(null, branch);
    const specialtySelect = document.getElementById('modal-specialty-select');
    if (specialtySelect && specialty) {
      specialtySelect.value = specialty;
      this.populateBookingDoctors();
    }
  }

  openPackageModal(packageId) {
    const pkg = ASTER_HEALTH_PACKAGES.find(p => p.id === packageId);
    this.openBookingModal();
    const reasonInput = document.getElementById('modal-reason-input');
    if (reasonInput && pkg) {
      reasonInput.value = `Health Checkup Booking: ${pkg.name} (₹${pkg.price})`;
    }
  }

  handleBookingSubmit() {
    const patientName = document.getElementById('modal-patient-name')?.value;
    const patientPhone = document.getElementById('modal-patient-phone')?.value;
    const docId = document.getElementById('modal-doctor-select')?.value;
    const date = document.getElementById('modal-date-input')?.value;

    const doc = ASTER_DOCTORS.find(d => d.id === docId);
    const docName = doc ? doc.name : 'Specialist Consultant';

    this.closeBookingModal();
    this.showToast(`✅ Appointment confirmed with ${docName} for ${date}! Confirmation SMS sent to ${patientPhone}.`);

    // Also notify via chatbot
    this.chatbot.addMessage({
      sender: 'bot',
      text: `🎉 **Appointment Confirmed!**\n\nDear **${patientName}**, your appointment with **${docName}** has been scheduled for **${date}**.\n\n- 🏥 **Hospital**: ${doc ? doc.hospital : 'Aster Hospital'}\n- 📱 **Confirmation SMS & WhatsApp** sent to: **${patientPhone}**\n- 💳 **Consultation Fee**: ${doc ? doc.consultationFee : '₹1,000'}\n\nPlease arrive 15 minutes prior to your slot time with previous medical records.`
    });
  }

  handleSpecialtyClick(specialtyId) {
    const spec = ASTER_SPECIALTIES.find(s => s.id === specialtyId);
    if (!spec) return;

    this.selectedSpecialty = spec.name;
    const specFilter = document.getElementById('doctor-specialty-filter');
    if (specFilter) specFilter.value = spec.name;

    this.filterDoctors();

    const docSection = document.getElementById('doctors');
    if (docSection) {
      docSection.scrollIntoView({ behavior: 'smooth' });
    }

    this.showToast(`Showing specialists for ${spec.name}`);
  }

  resetDoctorFilters() {
    const searchInput = document.getElementById('doctor-search-input');
    if (searchInput) searchInput.value = '';

    const specFilter = document.getElementById('doctor-specialty-filter');
    if (specFilter) specFilter.value = 'all';

    const branchFilter = document.getElementById('doctor-branch-filter');
    if (branchFilter) branchFilter.value = 'all';

    const expFilter = document.getElementById('doctor-experience-filter');
    if (expFilter) expFilter.value = 'all';

    const genderFilter = document.getElementById('doctor-gender-filter');
    if (genderFilter) genderFilter.value = 'all';

    const sortFilter = document.getElementById('doctor-sort-filter');
    if (sortFilter) sortFilter.value = 'featured';

    document.querySelectorAll('.hospital-chip').forEach(c => c.classList.remove('active'));
    const allChip = document.querySelector('.hospital-chip[data-branch="all"]');
    if (allChip) allChip.classList.add('active');

    this.filterDoctors();
    this.showToast('Reset all doctor filters');
  }

  handleSuggestionClick(suggestionText) {
    if (this.chatbot) {
      this.chatbot.toggleChat(true);
      this.chatbot.handleSendMessage(suggestionText);
    }
  }

  speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      this.showToast('Text-to-speech is not supported on this browser.');
    }
  }

  askBotAboutHospital(hospitalName) {
    if (this.chatbot) {
      this.chatbot.toggleChat(true);
      this.chatbot.handleSendMessage(`Tell me about ${hospitalName}, key specialties, and contact details`);
    }
  }

  showToast(message) {
    let toast = document.getElementById('app-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast-notification';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
}

// Attach to window
window.addEventListener('DOMContentLoaded', () => {
  window.asterApp = new AsterApp();
});

