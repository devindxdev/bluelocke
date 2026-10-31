import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './auth-harness.mjs'

const regions = [
  ['canada', 'BluelinkCanada'],
  ['usa', 'BluelinkUSA'],
  ['usa-kia', 'BluelinkUSAKia'],
  ['europe', 'BluelinkEurope'],
  ['india', 'BluelinkIndia'],
  ['australia', 'BluelinkAustralia'],
]
const vehicle = (id) => ({
  vehicleId: id,
  vehicleKey: id,
  regid: id,
  vin: `VIN-${id}`,
  nickName: id,
  nickname: id,
  modelName: 'Tucson',
  modelCode: 'Tucson',
  vehicleName: 'Tucson',
  modelYear: '2022',
  year: '2022',
  vehicleGeneration: '2',
  evStatus: 'N',
  detailInfo: { outColor: 'white', saleCarmdlCd: 'Preferred' },
})
for (const [region, className] of regions) {
  for (const remembered of [false, true]) {
    test(`${region}: photo metadata preserves ${remembered ? 'the cached vehicle' : 'the original first-vehicle choice'}`, async () => {
      const h = runtime()
      const manufacturer = region === 'usa-kia' ? 'kia' : 'hyundai'
      const Regional = h.load(`src/lib/bluelink-regions/${region}.ts`)[className]
      const client = new Regional({ ...h.account, manufacturer })
      const cars = [vehicle('first'), vehicle('second')]
      if (remembered) client.cache = { car: { id: 'second', vin: 'VIN-second' } }
      const requests = []
      client.request = async (props) => {
        requests.push(props)
        return {
          resp: { statusCode: 200, headers: {} },
          json: {
            responseHeader: { responseCode: 0 },
            result: { vehicles: cars },
            enrolledVehicleDetails: cars.map((vehicleDetails) => ({ vehicleDetails })),
            status: { statusCode: 0 },
            payload: { vehicleSummary: cars },
            resCode: '0000',
            resMsg: { vehicles: cars },
          },
        }
      }
      const car = await client.getCar()
      assert.equal(car.id, remembered ? 'second' : 'first')
      assert.equal(car.vin, remembered ? 'VIN-second' : 'VIN-first')
      assert.ok(Object.hasOwn(car, 'photoUrl'))
      if (region === 'canada') {
        assert.equal(requests.length, 2, 'Canada keeps its original vehicle registration request')
        assert.equal(JSON.parse(requests[1].data).vehicleId, car.id)
      } else assert.equal(requests.length, 1)
    })
  }
}
