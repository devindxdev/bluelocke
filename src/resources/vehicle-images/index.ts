import { vehicleImageRules } from './rules'
import { MatchedVehicleImage, VehicleImageLookupInput, VehicleImageRule } from './types'

const normalize = (value: string | undefined): string => {
  return (value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
}

const includesAny = (haystacks: string[], needles: string[] | undefined): boolean => {
  if (!needles || needles.length === 0) return true
  return needles.some((needle) => {
    const normalizedNeedle = normalize(needle)
    if (!normalizedNeedle) return false
    return haystacks.some((haystack) => haystack.includes(normalizedNeedle))
  })
}

const includesAll = (haystack: string, needles: string[] | undefined): boolean => {
  if (!needles || needles.length === 0) return true
  return needles.every((needle) => {
    const normalizedNeedle = normalize(needle)
    return normalizedNeedle.length > 0 && haystack.includes(normalizedNeedle)
  })
}

const matchesRule = (rule: VehicleImageRule, lookup: VehicleImageLookupInput): boolean => {
  const normalizedModelName = normalize(lookup.modelName)
  const normalizedManufacturer = normalize(lookup.manufacturer)
  const normalizedYear = normalize(lookup.modelYear)
  const trimCandidates = [normalize(lookup.modelTrim), normalizedModelName]
  const colorCandidates = [normalize(lookup.requestedColor), normalize(lookup.modelColour)]

  if (!includesAny([normalizedManufacturer], rule.match.manufacturerIncludesAny)) return false
  if (!includesAny([normalizedYear], rule.match.years)) return false
  if (!includesAll(normalizedModelName, rule.match.modelIncludesAll)) return false
  if (!includesAny(trimCandidates, rule.match.trimIncludesAny)) return false
  if (!includesAny(colorCandidates, rule.match.colorIncludesAny)) return false

  return true
}

export const resolveVehicleImage = (lookup: VehicleImageLookupInput): MatchedVehicleImage | undefined => {
  const matchedRule = vehicleImageRules.find((rule) => matchesRule(rule, lookup))
  if (!matchedRule) return undefined

  return {
    ruleId: matchedRule.id,
    cacheKey: `vehicle-image-${matchedRule.id}.png`,
    imageBase64: matchedRule.imageBase64,
  }
}
