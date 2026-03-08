import { tucsonBlackImage } from './assets/tucsonNLineBlackImage'
import { tucsonGreyImage } from './assets/tucsonNLineGreyImage'
import { tucsonRedImage } from './assets/tucsonNLineRedImage'
import { tucsonWhiteImage } from './assets/tucsonNLineWhiteImage'
import { tucsonXrtBlackImage } from './assets/tucsonXrtBlackImage'
import { tucsonXrtBlueImage } from './assets/tucsonXrtBlueImage'
import { tucsonXrtGreenImage } from './assets/tucsonXrtGreenImage'
import { tucsonXrtGreyImage } from './assets/tucsonXrtGreyImage'
import { tucsonXrtSilverImage } from './assets/tucsonXrtSilverImage'
import { tucsonXrtWhiteImage } from './assets/tucsonXrtWhiteImage'
import { tucsonPreferredBlackImage } from './assets/tucsonPreferredBlackImage'
import { tucsonPreferredBlueImage } from './assets/tucsonPreferredBlueImage'
import { tucsonPreferredGreenImage } from './assets/tucsonPreferredGreenImage'
import { tucsonPreferredGreyImage } from './assets/tucsonPreferredGreyImage'
import { tucsonPreferredSilverImage } from './assets/tucsonPreferredSilverImage'
import { tucsonPreferredWhiteImage } from './assets/tucsonPreferredWhiteImage'
import { tucsonHybridUltimateBlackImage } from './assets/tucsonHybridUltimateBlackImage'
import { tucsonHybridUltimateBlueImage } from './assets/tucsonHybridUltimateBlueImage'
import { tucsonHybridUltimateBronzeImage } from './assets/tucsonHybridUltimateBronzeImage'
import { tucsonHybridUltimateGreyImage } from './assets/tucsonHybridUltimateGreyImage'
import { tucsonHybridUltimateSilverImage } from './assets/tucsonHybridUltimateSilverImage'
import { tucsonHybridUltimateWhiteImage } from './assets/tucsonHybridUltimateWhiteImage'
import { VehicleImageRule } from './types'

export const vehicleImageRules: VehicleImageRule[] = [
  {
    id: 'hyundai-2025-tucson-xrt-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonXrtBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['grey', 'gray', 'net'],
    },
    imageBase64: tucsonXrtGreyImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt-green',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageBase64: tucsonXrtGreenImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageBase64: tucsonXrtBlueImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageBase64: tucsonXrtSilverImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageBase64: tucsonXrtWhiteImage,
  },
  {
    id: 'hyundai-2025-tucson-xrt',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['xrt'],
    },
    imageBase64: tucsonXrtBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['black', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonPreferredBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['grey', 'gray', 'nt2'],
    },
    imageBase64: tucsonPreferredGreyImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-green',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['green', 'wg2'],
    },
    imageBase64: tucsonPreferredGreenImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['blue', 'tb2'],
    },
    imageBase64: tucsonPreferredBlueImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageBase64: tucsonPreferredSilverImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageBase64: tucsonPreferredWhiteImage,
  },
  {
    id: 'hyundai-2025-tucson-preferred',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['preferred'],
    },
    imageBase64: tucsonPreferredBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['black', 'tcm', 'np1', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonHybridUltimateBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-bronze',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['bronze', 'bc1', 'cashmere'],
    },
    imageBase64: tucsonHybridUltimateBronzeImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageBase64: tucsonHybridUltimateGreyImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-blue',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['blue', 'ps8', 'tb2'],
    },
    imageBase64: tucsonHybridUltimateBlueImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-silver',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['silver', 'r2t'],
    },
    imageBase64: tucsonHybridUltimateSilverImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageBase64: tucsonHybridUltimateWhiteImage,
  },
  {
    id: 'hyundai-2025-tucson-hybrid-ultimate',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['ultimate'],
    },
    imageBase64: tucsonHybridUltimateBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-nline-red',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageBase64: tucsonRedImage,
  },
  {
    id: 'hyundai-2025-tucson-red',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['red', 'r2p'],
    },
    imageBase64: tucsonRedImage,
  },
  {
    id: 'hyundai-2025-tucson-nline-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageBase64: tucsonGreyImage,
  },
  {
    id: 'hyundai-2025-tucson-grey',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['grey', 'gray', 'r4g'],
    },
    imageBase64: tucsonGreyImage,
  },
  {
    id: 'hyundai-2025-tucson-nline-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageBase64: tucsonWhiteImage,
  },
  {
    id: 'hyundai-2025-tucson-white',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['white', 'tw3'],
    },
    imageBase64: tucsonWhiteImage,
  },
  {
    id: 'hyundai-2025-tucson-nline-black',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
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
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      colorIncludesAny: ['black', 'phantomblack', 'abyssblack'],
    },
    imageBase64: tucsonBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-nline',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
      trimIncludesAny: ['nline'],
    },
    imageBase64: tucsonBlackImage,
  },
  {
    id: 'hyundai-2025-tucson-fallback',
    match: {
      manufacturerIncludesAny: ['hyundai'],
      years: ['2025', '25', '2026', '26'],
      modelIncludesAll: ['tucson'],
    },
    imageBase64: tucsonBlackImage,
  },
]
