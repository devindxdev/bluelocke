export interface VehicleImageMatch {
  manufacturerIncludesAny?: string[]
  modelIncludesAll?: string[]
  trimIncludesAny?: string[]
  years?: string[]
  colorIncludesAny?: string[]
}

export interface VehicleImageRule {
  id: string
  match: VehicleImageMatch
  imageBase64?: string
  imageUrl?: string
}

export interface VehicleImageLookupInput {
  manufacturer?: string
  modelName?: string
  modelYear?: string
  modelTrim?: string
  modelColour?: string
  requestedColor?: string
}

export interface MatchedVehicleImage {
  ruleId: string
  cacheKey: string
  imageBase64?: string
  imageUrl?: string
}
