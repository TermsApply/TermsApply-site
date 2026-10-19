---
name: "Strongbox"
slug: "strongbox"
kind: "password manager"
platforms: ["iOS (tested)", "macOS (not tested)"]
declaredCollects:
  - "SDK-generated identifiers"
  - "may process device identifiers"
  - "technical information, app-usage events and purchase status"
  - "may derive approximate location from your IP address"
  - "estimate the likelihood of a purchase"
observedLeaves:
  - "On every cold start recorded in HAR (21): connections to `api.revenuecat.com` and to the Superwall hosts `api.superwall.me`, `collector.superwall.me`, `enrichment-api.superwall.com` and `subscriptions-api.superwall.com`."
  - "41 to 73 events per start to Superwall (from 1 s before to 20 s after launch), with a device profile of 50 to 61 fields (`device_attributes`; 9 events without `$appTransactionId`)."
  - "The device identifier (IDFV) to both RevenueCat and Superwall; `$appTransactionId` to Superwall."
  - "On first launch: an Apple AdServices attribution token and the App Store receipt to RevenueCat."
  - "A location derived from the IP address and a demand score, returned by Superwall and sent back by the app in later events."
  - "On first launch: 127 to 206 requests for paywall resources (Superwall content, Google Fonts, Stripe); in some first launches, connections to `m.stripe.com` and `m.stripe.network`, content not decrypted."
  - "Not observed: the content of password databases, the IDFA, identifying cookies."
observedFile: strongbox-ios-network-traffic
observedNote: "File 0001: three iPhones, 1 to 8 October 2026, 24 cold starts, app 1.65.2 (152), in-app purchase variant. Evidence page, Exhibits 2 to 9 and 12. The captures were made before the policy of 15 October 2026; it does not name Google Fonts, Stripe or `$appTransactionId`."
recipients:
  - name: "RevenueCat (api.revenuecat.com)"
    role: "Purchase handling: IDFV in every request; App Store receipt and AdServices attribution token on first launch"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Superwall (collector.superwall.me)"
    role: "41 to 73 events per start (from 1 s before to 20 s after launch), with a device profile"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Superwall (api.superwall.me)"
    role: "Paywall configuration (static_config)"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Superwall (enrichment-api.superwall.com)"
    role: "Device profile; returns a location derived from the IP address and a demand score"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Superwall (subscriptions-api.superwall.com)"
    role: "Contacted on every cold start recorded in HAR; the name is not visible in the packet capture without the proxy (T2)"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Superwall (user-content.superwalleditor.com)"
    role: "Paywall resources, downloaded in full on first launch"
    disclosed: true
    where: "15 Oct 2026 version"
  - name: "Google Fonts (fonts.googleapis.com)"
    role: "Fonts for the paywalls"
    disclosed: false
  - name: "Google Fonts (fonts.gstatic.com)"
    role: "Fonts for the paywalls"
    disclosed: false
  - name: "Stripe (js.stripe.com)"
    role: "Stripe.js for the paywall webview, fetched on a first launch"
    disclosed: false
  - name: "Stripe (m.stripe.com, m.stripe.network)"
    role: "Connections from the paywall webview on first launch; content not decrypted"
    disclosed: false
  - name: "DuckDuckGo test"
    role: "duckduckgo.com: connectivity test when the app comes to the foreground; no content sent"
    disclosed: true
    where: "support article"
  - name: "DuckDuckGo favicons"
    role: "icons.duckduckgo.com: favicons, only with the option switched on"
    disclosed: true
    where: "favicon passage"
---
Profile opened with file 0001. The file covers the iOS app from the App Store in its in-app purchase variant (bundle `com.markmcguill.strongbox`), version 1.65.2 (152). Strongbox Pro, Strongbox Zero and the macOS version were not tested. "Disclosed" below means named in the privacy policy of 15 October 2026 or in the support article on network connections as accessed on 16 October 2026. In the versions in force at the time of the study (the policy of 9 May 2024 and the article as of 8 October 2026), none of the RevenueCat, Superwall, Google Fonts or Stripe hosts was named. The new versions name RevenueCat and Superwall, and mention resources from "third-party hosts" without naming Google Fonts or Stripe.
