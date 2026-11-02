export interface ImageCredit {
  file: string
  photographer: string
  source: string
}

/**
 * Provenance for every photograph shipped with the demo. All are from Unsplash and used
 * under the Unsplash License; the same list lives in `public/images/CREDITS.md`.
 */
export const imageCredits: ImageCredit[] = [
  { file: 'hero-consultation.webp', photographer: 'Vitaly Gariev', source: 'https://unsplash.com/photos/MJmsLpeHPfg' },
  { file: 'care-notes.webp', photographer: 'Vitaly Gariev', source: 'https://unsplash.com/photos/8WYkI3cEZm8' },
  { file: 'team-1.webp', photographer: 'Vitaly Gariev', source: 'https://unsplash.com/photos/iyeUwItlIPk' },
  { file: 'team-2.webp', photographer: 'Vitaly Gariev', source: 'https://unsplash.com/photos/HGiYag5IjXw' },
  { file: 'team-3.webp', photographer: 'Vitaly Gariev', source: 'https://unsplash.com/photos/XSPFs82j_v0' },
  { file: 'clinic-downtown.webp', photographer: 'Kouji Tsuru', source: 'https://unsplash.com/photos/I4Pkd8bDGkk' },
  { file: 'clinic-northside.webp', photographer: 'Seyed Amir Mohammad Tabatabaee', source: 'https://unsplash.com/photos/AHjWQL-hY30' },
  { file: 'clinic-westside.webp', photographer: 'Benyamin Bohlouli', source: 'https://unsplash.com/photos/B_sK_xgzwVA' }
]

export const UNSPLASH_LICENSE = 'https://unsplash.com/license'
