/**
 * Sri Lankan Commercial & Development Banks and Key Towns / Branches
 * Pre-populated constants and normalization utilities for POS Cheque and Split Payments.
 */

export const SRI_LANKAN_BANKS: string[] = [
  'Bank of Ceylon (BOC)',
  "People's Bank",
  'Commercial Bank of Ceylon',
  'Sampath Bank',
  'Hatton National Bank (HNB)',
  'Seylan Bank',
  'National Savings Bank (NSB)',
  'NDB Bank',
  'DFCC Bank',
  'Nations Trust Bank (NTB)',
  'Pan Asia Bank',
  'Union Bank of Colombo',
  'Cargills Bank',
  'Amana Bank',
  'Standard Chartered Bank',
  'HSBC Sri Lanka',
  'Regional Development Bank (RDB)',
  'Sanasa Development Bank (SDB)',
  'State Mortgage & Investment Bank (SMIB)',
  'HDFC Bank of Sri Lanka',
  'Citibank N.A.',
  'Indian Bank',
  'Indian Overseas Bank',
  'State Bank of India',
  'Habib Bank',
  'MCB Bank',
  'Deutsche Bank',
];

export const SRI_LANKAN_TOWNS: string[] = [
  // ── 1. Southern Province - Matara District (Comprehensive Coverage) ──
  'Matara',
  'Makandura',
  'Deiyandara',
  'Hakmana',
  'Mawarala',
  'Urubokka',
  'Kamburupitiya',
  'Akuressa',
  'Deniyaya',
  'Morawaka',
  'Pitabeddara',
  'Weligama',
  'Dikwella',
  'Thihagoda',
  'Kotapola',
  'Mulatiyana',
  'Pasgoda',
  'Devinuwara',
  'Gandara',
  'Kekanadura',
  'Malimbada',
  'Athuraliya',
  'Kirinda Puhulwella',
  'Mirissa',
  'Welipitiya',
  'Telijjawila',
  'Yatiyana',
  'Rotumba',
  'Radawela',
  'Bangama',
  'Bopagoda',

  // ── 2. Southern Province - Galle District ──
  'Galle',
  'Ambalangoda',
  'Hikkaduwa',
  'Elpitiya',
  'Baddegama',
  'Karapitiya',
  'Bentota',
  'Koggala',
  'Ahangama',
  'Batapola',
  'Rathgama',
  'Nagoda',
  'Udugama',
  'Yakkalamulla',
  'Neluwa',
  'Thawalama',
  'Habaraduwa',
  'Imaduwa',

  // ── 3. Southern Province - Hambantota District ──
  'Hambantota',
  'Tangalle',
  'Beliatta',
  'Tissamaharama',
  'Ambalantota',
  'Walasmulla',
  'Weeraketiya',
  'Middeniya',
  'Angunukolapelessa',
  'Suriyawewa',
  'Ranna',
  'Lunugamvehera',
  'Katuwana',

  // ── 4. Western Province - Colombo District ──
  'Colombo - Fort',
  'Colombo - Pettah',
  'Colombo - Kollupitiya',
  'Colombo - Bambalapitiya',
  'Colombo - Borella',
  'Colombo - Maradana',
  'Colombo - Wellawatte',
  'Colombo - Cinnamon Gardens',
  'Colombo - Dematagoda',
  'Colombo - Kotahena',
  'Colombo - Grandpass',
  'Colombo - Mattakkuliya',
  'Colombo - Narahenpita',
  'Colombo - Havelock Town',
  'Dehiwala',
  'Mount Lavinia',
  'Ratmalana',
  'Moratuwa',
  'Nugegoda',
  'Maharagama',
  'Kottawa',
  'Homagama',
  'Pannipitiya',
  'Malabe',
  'Battaramulla',
  'Rajagiriya',
  'Kaduwela',
  'Hanwella',
  'Avissawella',
  'Piliyandala',
  'Kesbewa',
  'Padukka',
  'Athurugiriya',
  'Kohuwala',

  // ── 5. Western Province - Gampaha District ──
  'Gampaha',
  'Negombo',
  'Ja-Ela',
  'Wattala',
  'Kandana',
  'Kelaniya',
  'Kiribathgoda',
  'Kadawatha',
  'Ragama',
  'Nittambuwa',
  'Mirigama',
  'Minuwangoda',
  'Divulapitiya',
  'Veyangoda',
  'Katunayake',
  'Seeduwa',
  'Ganemulla',
  'Delgoda',
  'Yakkala',
  'Biyagama',
  'Pugoda',
  'Dompe',

  // ── 6. Western Province - Kalutara District ──
  'Kalutara',
  'Panadura',
  'Horana',
  'Bandaragama',
  'Matugama',
  'Beruwala',
  'Aluthgama',
  'Wadduwa',
  'Ingiriya',
  'Bulathsinhala',
  'Agalawatta',
  'Dodangoda',
  'Payagala',

  // ── 7. Central Province - Kandy District ──
  'Kandy',
  'Peradeniya',
  'Katugastota',
  'Gampola',
  'Nawalapitiya',
  'Kundasale',
  'Digana',
  'Teldeniya',
  'Akurana',
  'Gelioya',
  'Pilimathalawa',
  'Kadugannawa',
  'Wattegama',
  'Menikhinna',
  'Ampitiya',

  // ── 8. Central Province - Matale District ──
  'Matale',
  'Dambulla',
  'Galewela',
  'Sigiriya',
  'Ukuwela',
  'Rattota',
  'Pallepola',
  'Naula',
  'Yatawatta',

  // ── 9. Central Province - Nuwara Eliya District ──
  'Nuwara Eliya',
  'Hatton',
  'Talawakelle',
  'Ginigathena',
  'Norwood',
  'Maskeliya',
  'Kotagala',
  'Ragala',
  'Walapane',
  'Hanguranketha',

  // ── 10. North Western Province - Kurunegala District ──
  'Kurunegala',
  'Kuliyapitiya',
  'Narammala',
  'Pannala',
  'Wariyapola',
  'Nikaweratiya',
  'Maho',
  'Giriulla',
  'Alawwa',
  'Polgahawela',
  'Ibbagamuwa',
  'Mawathagama',
  'Hettipola',
  'Bingiriya',
  'Galgamuwa',

  // ── 11. North Western Province - Puttalam District ──
  'Puttalam',
  'Chilaw',
  'Wennappuwa',
  'Marawila',
  'Dankotuwa',
  'Nattandiya',
  'Anamaduwa',
  'Mahawewa',
  'Madampe',
  'Kalpitiya',
  'Mundel',

  // ── 12. North Central Province - Anuradhapura District ──
  'Anuradhapura',
  'Kekirawa',
  'Medawachchiya',
  'Eppawala',
  'Tambuttegama',
  'Galnewa',
  'Nochchiyagama',
  'Mihintale',
  'Kahatagasdigiliya',
  'Habarana',
  'Padaviya',
  'Talawa',

  // ── 13. North Central Province - Polonnaruwa District ──
  'Polonnaruwa',
  'Hingurakgoda',
  'Kaduruwela',
  'Medirigiriya',
  'Minneriya',
  'Welikanda',
  'Aralaganwila',
  'Bakamuna',

  // ── 14. Sabaragamuwa Province - Ratnapura District ──
  'Ratnapura',
  'Balangoda',
  'Embilipitiya',
  'Pelmadulla',
  'Kuruwita',
  'Kahawatta',
  'Eheliyagoda',
  'Rakwana',
  'Godakawela',
  'Kalawana',
  'Nivithigala',

  // ── 15. Sabaragamuwa Province - Kegalle District ──
  'Kegalle',
  'Mawanella',
  'Warakapola',
  'Ruwanwella',
  'Yatiyantota',
  'Dehiowita',
  'Deraniyagala',
  'Rambukkana',
  'Kitulgala',
  'Galigamuwa',

  // ── 16. Uva Province - Badulla District ──
  'Badulla',
  'Bandarawela',
  'Welimada',
  'Mahiyanganaya',
  'Hali Ela',
  'Diyatalawa',
  'Ella',
  'Haputale',
  'Passara',
  'Demodara',

  // ── 17. Uva Province - Monaragala District ──
  'Monaragala',
  'Wellawaya',
  'Buttala',
  'Bibile',
  'Kataragama',
  'Siyambalanduwa',
  'Thanamalwila',
  'Medagama',

  // ── 18. Eastern Province - Ampara District ──
  'Ampara',
  'Kalmunai',
  'Akkaraipattu',
  'Sammanthurai',
  'Pottuvil',
  'Sainthamaruthu',
  'Nintavur',
  'Uhana',
  'Dehiattakandiya',
  'Maha Oya',

  // ── 19. Eastern Province - Batticaloa District ──
  'Batticaloa',
  'Kattankudy',
  'Eravur',
  'Valaichchenai',
  'Chenkalady',
  'Kaluwanchikudy',
  'Oddamavadi',

  // ── 20. Eastern Province - Trincomalee District ──
  'Trincomalee',
  'Kinniya',
  'Muttur',
  'Kantale',
  'Kuchchaveli',
  'Nilaveli',
  'Serunuwara',

  // ── 21. Northern Province - Jaffna District ──
  'Jaffna',
  'Chavakachcheri',
  'Point Pedro',
  'Nallur',
  'Chunnakam',
  'Manipay',
  'Vaddukoddai',
  'Valvettithurai',
  'Kopay',
  'Karainagar',
  'Atchuvely',

  // ── 22. Northern Province - Kilinochchi District ──
  'Kilinochchi',
  'Paranthan',
  'Pallai',
  'Poonakary',

  // ── 23. Northern Province - Mannar District ──
  'Mannar',
  'Pesalai',
  'Thalaimannar',
  'Madhu',
  'Murunkan',

  // ── 24. Northern Province - Vavuniya District ──
  'Vavuniya',
  'Cheddikulam',
  'Nedunkeni',
  'Omanthai',

  // ── 25. Northern Province - Mullaitivu District ──
  'Mullaitivu',
  'Puthukkudiyiruppu',
  'Oddusuddan',
  'Mallavi',
  'Mankulam',
];

/**
 * Splits a composite "Bank - Town" string into separate bank and town fields.
 * Safely handles un-hyphenated legacy records, leading dashes, or empty inputs.
 */
export const splitBankAndTown = (combined?: string): { bank: string; town: string } => {
  if (!combined || typeof combined !== 'string') {
    return { bank: '', town: '' };
  }
  const trimmed = combined.trim();
  const separatorIndex = trimmed.indexOf(' - ');
  if (separatorIndex !== -1) {
    const bank = trimmed.slice(0, separatorIndex).trim();
    const town = trimmed.slice(separatorIndex + 3).trim();
    return { bank, town };
  }
  // If string starts with a dash prefix (e.g., "- Makandura" when town was entered first)
  if (trimmed.startsWith('- ')) {
    return { bank: '', town: trimmed.slice(2).trim() };
  }
  // If the trimmed string strictly matches an existing Sri Lankan town entry
  if (SRI_LANKAN_TOWNS.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return { bank: '', town: trimmed };
  }
  return { bank: trimmed, town: '' };
};

/**
 * Combines separate Bank Name and Town/Branch into a clean unified string for backend storage.
 * e.g., "Commercial Bank of Ceylon - Pettah" or "BOC" if no town is provided.
 */
export const formatBankAndTown = (bank?: string, town?: string): string => {
  const b = (bank || '').trim();
  const t = (town || '').trim();
  if (b && t) {
    return `${b} - ${t}`;
  }
  if (t && !b) {
    return `- ${t}`;
  }
  return b;
};

// Re-export universal cheque metadata parser
export { parseChequeMetadata, type ParsedChequeInfo } from './chequeParser';


