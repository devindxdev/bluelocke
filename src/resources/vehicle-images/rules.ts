import { tucsonBlackImage } from './assets/tucsonNLineBlackImage'
import { VehicleImageRule } from './types'

export const vehicleImageRules: VehicleImageRule[] = [
  {
    id: 'hyundai-2025-tucson-nline-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['black', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25'],
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['black', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-nline',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
    },
    imageBase64: tucsonBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-fallback',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25'],
      modelIncludesAll: ['tucson'],
    },
    imageBase64: tucsonBlackImage,
  },
]
