import { VehicleImageRule } from './types'

const VEHICLE_IMAGE_BASE =
  'https://raw.githubusercontent.com/devindxdev/bluelocke/refs/heads/main/assets/vehicle-images'

type SupportedYear = '2025' | '2026'

interface YearConfig {
  idYear: SupportedYear
  matchYears: string[]
  imageYear: SupportedYear
}

const YEAR_CONFIGS: YearConfig[] = [
  {
    idYear: '2025',
    matchYears: ['2025', '25'],
    imageYear: '2025',
  },
  {
    idYear: '2026',
    matchYears: ['2026', '26'],
    imageYear: '2026',
  },
]

const image = (year: SupportedYear, fileName: string) => `${VEHICLE_IMAGE_BASE}/${year}/${fileName}`

const buildTucsonRules = (yearConfig: YearConfig): VehicleImageRule[] => [
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-black`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-grey`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['grey', 'gray', 'net'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-grey.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-green`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-green.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-blue`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-blue.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-silver`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-silver.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt-white`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-white.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-xrt`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-xrt-black.png'),
  },

  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-black`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-grey`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['grey', 'gray', 'nt2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-grey.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-green`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-green.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-blue`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-blue.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-silver`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-silver.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred-white`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-white.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-preferred`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-preferred-black.png'),
  },

  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-black`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-bronze`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['bronze', 'bc1', 'cashmere'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-bronze.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-grey`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-grey.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-blue`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['blue', 'ps8', 'tb2'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-blue.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-silver`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-silver.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate-white`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-white.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-hybrid-ultimate`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-hybrid-ultimate-black.png'),
  },

  {
    id: `hyundai-${yearConfig.idYear}-tucson-nline-red`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-red.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-red`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-red.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-nline-grey`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-grey.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-grey`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-grey.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-nline-white`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-white.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-white`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-white.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-nline-black`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-black`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-nline`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-black.png'),
  },
  {
    id: `hyundai-${yearConfig.idYear}-tucson-fallback`,
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: yearConfig.matchYears,
      modelIncludesAll: ['tucson'],
    },
    imageUrl: image(yearConfig.imageYear, 'tucson-nline-black.png'),
  },
]

export const vehicleImageRules: VehicleImageRule[] = YEAR_CONFIGS.flatMap((yearConfig) => buildTucsonRules(yearConfig))
