import { VehicleImageRule } from './types'

const VEHICLE_IMAGE_BASE = 'https://raw.githubusercontent.com/devindxdev/bluelocke/main/assets/vehicle-images'
const YEARS_2025_2026 = ['2025', '25', '2026', '26']
const image = (fileName: string) => `${VEHICLE_IMAGE_BASE}/${fileName}`

export const vehicleImageRules: VehicleImageRule[] = [
  {
    id: 'hyundai-2025-tucson-xrt-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image('tucson-xrt-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['grey', 'gray', 'net'],
    },
    imageUrl: image('tucson-xrt-grey.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt-green',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageUrl: image('tucson-xrt-green.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageUrl: image('tucson-xrt-blue.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image('tucson-xrt-silver.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image('tucson-xrt-white.png'),
  },
  {
    id: 'hyundai-2025-tucson-xrt',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
    },
    imageUrl: image('tucson-xrt-black.png'),
  },

  {
    id: 'hyundai-2025-tucson-preferred-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image('tucson-preferred-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['grey', 'gray', 'nt2'],
    },
    imageUrl: image('tucson-preferred-grey.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred-green',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageUrl: image('tucson-preferred-green.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageUrl: image('tucson-preferred-blue.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image('tucson-preferred-silver.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image('tucson-preferred-white.png'),
  },
  {
    id: 'hyundai-2025-tucson-preferred',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
    },
    imageUrl: image('tucson-preferred-black.png'),
  },

  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image('tucson-hybrid-ultimate-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-bronze',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['bronze', 'bc1', 'cashmere'],
    },
    imageUrl: image('tucson-hybrid-ultimate-bronze.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image('tucson-hybrid-ultimate-grey.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['blue', 'ps8', 'tb2'],
    },
    imageUrl: image('tucson-hybrid-ultimate-blue.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageUrl: image('tucson-hybrid-ultimate-silver.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image('tucson-hybrid-ultimate-white.png'),
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
    },
    imageUrl: image('tucson-hybrid-ultimate-black.png'),
  },

  {
    id: 'hyundai-2025-tucson-nline-red',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageUrl: image('tucson-nline-red.png'),
  },
  {
    id: 'hyundai-2025-tucson-red',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageUrl: image('tucson-nline-red.png'),
  },
  {
    id: 'hyundai-2025-tucson-nline-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image('tucson-nline-grey.png'),
  },
  {
    id: 'hyundai-2025-tucson-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageUrl: image('tucson-nline-grey.png'),
  },
  {
    id: 'hyundai-2025-tucson-nline-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image('tucson-nline-white.png'),
  },
  {
    id: 'hyundai-2025-tucson-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageUrl: image('tucson-nline-white.png'),
  },
  {
    id: 'hyundai-2025-tucson-nline-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image('tucson-nline-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageUrl: image('tucson-nline-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-nline',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
    },
    imageUrl: image('tucson-nline-black.png'),
  },
  {
    id: 'hyundai-2025-tucson-fallback',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: YEARS_2025_2026,
      modelIncludesAll: ['tucson'],
    },
    imageUrl: image('tucson-nline-black.png'),
  },
]
