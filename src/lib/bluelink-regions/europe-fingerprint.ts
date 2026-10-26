/*!
 * Includes @noble/hashes, Copyright (c) 2022 Paul Miller (https://paulmillr.com).
 * OneApp signing protocol adapted from hyundai_kia_connect_api,
 * Copyright (c) 2021 Fuat Akgun.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { Buffer } from 'buffer'

export function hyundaiAuthHeaders(deviceId: string, timezone: string, body = ''): Record<string, string> {
  const headers: Record<string, string> = {
    'client-id': 'com.hyundai.oneapp.eu',
    'client-name': 'HyundaiEU',
    'client-version': '1.4.0',
    'client-os-code': 'android',
    'client-os-version': '14',
    'client-device-id': deviceId,
    'client-device-model': 'SM-S918B',
    'client-notification-provider-type': 'FCM',
    locale: 'EN',
    timezone,
    'App-Request-Id': `${UUID.string().replaceAll('-', '').slice(0, 24).toUpperCase()}_${deviceId.replaceAll('-', '')}_AOS`,
    'X-Brand': 'Hyundai',
    'X-Region': 'eu',
    'X-Timestamp': Date.now().toString(),
    'User-Agent': 'okhttp/4.12.0',
    Accept: '*/*',
    'Accept-Language': 'en',
  }
  const identity = ['client-id', 'client-name', 'client-version', 'client-os-code']
    .map((name) => headers[name])
    .join('')
  const key = identity + 'OsZDfDuCyVXyfqjCoA2JbX2MrLpGwNBC'
  const message = identity + headers['client-os-version'] + headers['X-Timestamp'] + body.replace(/[ \t\n\v\f\r]/g, '')
  headers['X-Fingerprint'] = Buffer.from(hmac(sha256, Buffer.from(key), Buffer.from(message))).toString('hex')
  if (body) headers['Content-Type'] = 'application/json'
  return headers
}
