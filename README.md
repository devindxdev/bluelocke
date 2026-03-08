# Bluelocke

## What is this?

An alternative Bluelink app for Hyundai / Kia / Genesis vehicles. It is a [Scriptable app](https://scriptable.app/) for iOS that lets you control your car using the Bluelink API.

## Features

* Auto-Updating Homescreen and Lockscreen Widgets
* Fresh and more responsive app UI
* Single click options for common commands (lock, warm, charge etc) in both app and in IOS Control Center
* Siri voice support "Hey Siri, Warm the car"
* Automations via IOS Shortcuts like walk-away lock
* Unlimited Custom Climate configurations 

## Docs

See [https://devindxdev.github.io/bluelocke/](https://devindxdev.github.io/bluelocke/) for documentation on features and setup.

## Dev Instructions

### Repo Structure / Codebase

The code is written in TypeScript and transpiled to JavaScript, which Scriptable requires.

`/src` is the main source code of the app  
`/docs` is a Just the Docs (Jekyll) site published via GitHub Pages.  
`/.github/workflows/docs.yml` deploys the docs site.  
`/exampleData` is a set of sample API payloads.

### Building the code

```bash
npm install
npm run build
```
