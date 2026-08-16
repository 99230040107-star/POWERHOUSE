/**
 * Aster Hospitals Semantic BM25 Indexer & Retrieval Engine
 * Builds an inverted index and ranks relevant knowledge chunks for QA.
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each',
  'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up',
  'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'please', 'tell', 'want', 'know', 'give', 'show'
]);

const MEDICAL_SYNONYMS = {
  'heart': ['cardiac', 'cardiology', 'cardiologist', 'angioplasty', 'ecg', 'echo', 'bypass', 'cabg', 'tavi'],
  'cardio': ['heart', 'cardiac', 'cardiologist'],
  'attack': ['heart', 'infarction', 'emergency', 'angioplasty', 'pami', 'stroke'],
  'brain': ['neuro', 'neurology', 'neurosurgeon', 'neurosurgery', 'stroke', 'epilepsy', 'dbs', 'head'],
  'stroke': ['brain', 'neuro', 'thrombectomy', 'paralysis', 'emergency', 'code'],
  'cancer': ['oncology', 'oncologist', 'tumor', 'chemotherapy', 'radiation', 'immunotherapy', 'bmt'],
  'bone': ['ortho', 'orthopaedics', 'orthopedic', 'fracture', 'joint', 'knee', 'hip', 'spine'],
  'joint': ['knee', 'hip', 'orthopaedics', 'replacement', 'arthroscopy'],
  'knee': ['orthopaedics', 'joint', 'replacement', 'mako', 'tkr'],
  'liver': ['hepatology', 'gastro', 'gastroenterology', 'transplant', 'cirrhosis', 'hpb', 'fibroscan'],
  'kidney': ['nephrology', 'dialysis', 'renal', 'urology', 'transplant', 'creatinine', 'stone'],
  'stomach': ['gastro', 'gastroenterology', 'digestive', 'endoscopy', 'colonoscopy', 'acidity'],
  'pregnant': ['maternity', 'obstetrics', 'gynecology', 'gynaecology', 'nurture', 'delivery', 'fetal', 'baby'],
  'maternity': ['pregnancy', 'delivery', 'obstetrics', 'nurture', 'baby', 'labor'],
  'baby': ['pediatric', 'pediatrics', 'paediatrics', 'nicu', 'neonatal', 'child'],
  'child': ['pediatric', 'paediatric', 'nicu', 'picu', 'neonatology'],
  'emergency': ['urgent', 'ambulance', 'hotline', 'trauma', 'critical', 'icu', 'casualty', '24/7', 'helpline'],
  'helpline': ['emergency', 'contact', 'phone', 'call', 'number', 'hotline'],
  'contact': ['phone', 'number', 'call', 'emergency', 'helpline', 'email', 'address'],
  'phone': ['contact', 'number', 'call', 'emergency', 'hotline'],
  'doctor': ['specialist', 'consultant', 'physician', 'surgeon', 'dr', 'doctors', 'specialists'],
  'cost': ['price', 'packages', 'package', 'fees', 'pricing', 'rate', 'tariff'],
  'insurance': ['tpa', 'cashless', 'mediclaim', 'policy', 'reimbursement', 'empanelled'],
  'package': ['packages', 'checkup', 'wellness', 'screening', 'health', 'pricing', 'cost', 'tests'],
  'packages': ['package', 'checkup', 'wellness', 'screening', 'health', 'pricing', 'cost', 'tests'],
  'checkup': ['package', 'packages', 'wellness', 'screening', 'health', 'investigations', 'tests', 'fasting'],
  'wellness': ['checkup', 'package', 'screening', 'preventive', 'health'],
  'screening': ['checkup', 'package', 'wellness', 'tests', 'cancer', 'cardiac'],
  'tests': ['investigations', 'blood', 'screening', 'checkup', 'package', 'lab', 'ecg', 'xray', 'ultrasound', 'hba1c'],
  'fasting': ['checkup', 'package', 'instructions', 'preparation', 'sugar', 'lipid'],
  'bangalore': ['bengaluru', 'cmi', 'hebbal', 'whitefield', 'karnataka'],
  'kochi': ['cochin', 'medcity', 'kerala', 'cheranallur'],
  'calicut': ['kozhikode', 'mims', 'malabar', 'kerala'],
  'kottakkal': ['mims', 'malappuram', 'kerala'],
  'kannur': ['mims', 'kerala', 'chala'],
  'hyderabad': ['prime', 'ameerpet', 'telangana'],
  'guntur': ['ramesh', 'andhra', 'ongole', 'vijayawada'],
  'hospitals': ['hospital', 'branches', 'campuses', 'network', 'locations', 'units', 'centers'],
  'hospital': ['hospitals', 'branch', 'campus', 'location', 'unit', 'center'],
  'appointment': ['book', 'booking', 'consult', 'consultation', 'slot', 'opd', 'schedule']
};

export class SearchIndexer {
  constructor() {
    this.invertedIndex = new Map(); // term -> Map(chunkId -> termFrequency)
    this.chunkMap = new Map();      // chunkId -> chunkObject
    this.chunkLengths = new Map();  // chunkId -> tokenCount
    this.avgChunkLength = 0;
    this.totalChunks = 0;
    this.vocabulary = new Set();
    this.isIndexed = false;
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\d]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  }

  buildIndex(chunks) {
    this.invertedIndex.clear();
    this.chunkMap.clear();
    this.chunkLengths.clear();
    this.vocabulary.clear();

    this.totalChunks = chunks.length;
    let totalTokens = 0;

    for (const chunk of chunks) {
      this.chunkMap.set(chunk.chunkId, chunk);
      
      // Tokenize different sections with weights
      const titleTokens = this.tokenize(chunk.pageTitle);
      const headingTokens = this.tokenize(chunk.heading);
      const contentTokens = this.tokenize(chunk.content);
      const breadcrumbTokens = this.tokenize(chunk.breadcrumbs.join(' '));

      const termFreqs = new Map();

      // Weighting: Title (3x), Heading (2.5x), Breadcrumb (2x), Content (1x)
      const addTokens = (tokens, weight = 1) => {
        for (const token of tokens) {
          const current = termFreqs.get(token) || 0;
          termFreqs.set(token, current + weight);
          this.vocabulary.add(token);
        }
      };

      addTokens(contentTokens, 1);
      addTokens(headingTokens, 2.5);
      addTokens(titleTokens, 3.0);
      addTokens(breadcrumbTokens, 2.0);

      const chunkLength = contentTokens.length + (headingTokens.length * 2) + (titleTokens.length * 2);
      this.chunkLengths.set(chunk.chunkId, chunkLength);
      totalTokens += chunkLength;

      // Populate Inverted Index
      for (const [term, freq] of termFreqs.entries()) {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, new Map());
        }
        this.invertedIndex.get(term).set(chunk.chunkId, freq);
      }
    }

    this.avgChunkLength = totalTokens / (this.totalChunks || 1);
    this.isIndexed = true;
    return {
      totalIndexedChunks: this.totalChunks,
      vocabularySize: this.vocabulary.size
    };
  }

  /**
   * Expands query with domain synonyms
   */
  expandQuery(queryTokens) {
    const expanded = new Set(queryTokens);
    for (const token of queryTokens) {
      if (MEDICAL_SYNONYMS[token]) {
        MEDICAL_SYNONYMS[token].forEach(syn => expanded.add(syn));
      }
      // Check prefix/substring matches in synonym keys
      for (const key in MEDICAL_SYNONYMS) {
        if (token.includes(key) || key.includes(token)) {
          MEDICAL_SYNONYMS[key].forEach(syn => expanded.add(syn));
        }
      }
    }
    return Array.from(expanded);
  }

  /**
   * BM25 Search Algorithm
   * Parameters: k1 = 1.2, b = 0.75
   */
  search(query, topK = 5) {
    if (!this.isIndexed || !query) return [];

    const rawQueryTokens = this.tokenize(query);
    const queryTokens = this.expandQuery(rawQueryTokens);
    if (queryTokens.length === 0) return [];

    const k1 = 1.2;
    const b = 0.75;
    const scores = new Map(); // chunkId -> BM25 Score
    const matchReasons = new Map(); // chunkId -> matched terms

    const rawQueryLower = query.toLowerCase();

    for (const token of queryTokens) {
      const posting = this.invertedIndex.get(token);
      if (!posting) continue;

      const docFrequency = posting.size;
      // IDF Calculation with floor
      const idf = Math.log(1 + (this.totalChunks - docFrequency + 0.5) / (docFrequency + 0.5));

      for (const [chunkId, termFreq] of posting.entries()) {
        const docLen = this.chunkLengths.get(chunkId) || this.avgChunkLength;
        const normDocLen = 1 - b + b * (docLen / this.avgChunkLength);
        const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * normDocLen);
        const termScore = idf * tf;

        const currentScore = scores.get(chunkId) || 0;
        scores.set(chunkId, currentScore + termScore);

        if (!matchReasons.has(chunkId)) matchReasons.set(chunkId, new Set());
        matchReasons.get(chunkId).add(token);
      }
    }

    // Exact Phrase & Intent Boosters
    for (const [chunkId, chunk] of this.chunkMap.entries()) {
      let score = scores.get(chunkId) || 0;
      if (score === 0) continue;

      const textLower = chunk.fullText.toLowerCase();

      // Exact query match boost
      if (textLower.includes(rawQueryLower)) {
        score += 8.0;
      }

      // Emergency intent booster
      if (rawQueryLower.includes('emergency') || rawQueryLower.includes('ambulance') || rawQueryLower.includes('urgent') || rawQueryLower.includes('helpline') || rawQueryLower.includes('number')) {
        if (chunk.category === 'Emergency' || textLower.includes('emergency hotline') || textLower.includes('080-4647') || textLower.includes('155218')) {
          score += 12.0;
        }
      }

      // Location specific intent booster
      ['bangalore', 'hebbal', 'whitefield', 'kochi', 'medcity', 'calicut', 'kottakkal', 'kannur', 'hyderabad'].forEach(loc => {
        if (rawQueryLower.includes(loc) && textLower.includes(loc)) {
          score += 6.0;
        }
      });

      // Doctor/Specialty specific intent booster
      ['cardiology', 'neuro', 'cancer', 'oncology', 'ortho', 'transplant', 'gastro', 'maternity', 'packages', 'checkup', 'insurance', 'tpa'].forEach(spec => {
        if (rawQueryLower.includes(spec) && textLower.includes(spec)) {
          score += 5.0;
        }
      });

      scores.set(chunkId, score);
    }

    // Rank and return top K
    const rankedResults = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([chunkId, score]) => {
        const chunk = this.chunkMap.get(chunkId);
        return {
          chunkId,
          score: parseFloat(score.toFixed(3)),
          pageTitle: chunk.pageTitle,
          url: chunk.url,
          category: chunk.category,
          heading: chunk.heading,
          content: chunk.content,
          breadcrumbs: chunk.breadcrumbs,
          matchedTerms: Array.from(matchReasons.get(chunkId) || [])
        };
      });

    return rankedResults;
  }
}
