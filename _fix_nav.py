#!/usr/bin/env python3
import os, re

CANONICAL = '''<div id="megaNav" class="mega-nav-overlay" aria-hidden="true">
  <button class="mega-nav-close" onclick="closeMegaNav()" aria-label="Close menu">&times;</button>
  <div class="mega-nav-grid">

    <div class="mega-nav-col">
      <h3>Navigate</h3>
      <ul>
        <li><a href="/index.html">Home</a></li>
        <li><a href="/leadership/SkyesOverLondon.html">Founder</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/portfolio.html">Portfolio</a></li>
        <li><a href="/network.html">Network</a></li>
        <li><a href="/credibility.html">Credibility</a></li>
        <li><a href="/platforms.html">Platforms</a></li>
        <li><a href="/status.html">Status</a></li>
        <li><a href="/blog.html">Blog</a></li>
        <li><a href="/vault.html">Vault</a></li>
        <li><a href="/get-started/index.html">Get Started</a></li>
        <li><a href="/sitemap-visual.html">Site Map</a></li>
      </ul>
    </div>

    <div class="mega-nav-col">
      <h3>SkyeSuite</h3>
      <ul>
        <li><a href="/SkyeDocx/index.html">SkyeDocx</a></li>
        <li><a href="/SkyeSheets/index.html">SkyeSheets</a></li>
        <li><a href="/SkyeSlides/index.html">SkyeSlides</a></li>
        <li><a href="/SkyeCollab/index.html">SkyeCollab</a></li>
        <li><a href="/SkyeDrive/index.html">SkyeDrive</a></li>
        <li><a href="/SkyeFlow/index.html">SkyeFlow</a></li>
        <li><a href="/SkyeLedger/index.html">SkyeLedger</a></li>
        <li><a href="/SkyeOps/index.html">SkyeOps</a></li>
        <li><a href="/SkyeArchive/index.html">SkyeArchive</a></li>
      </ul>
      <h3 style="margin-top:1rem">kAIxu</h3>
      <ul>
        <li><a href="/kAIxu/index.html">kAIxu Home</a></li>
        <li><a href="/kAIxu/docs.html">Docs</a></li>
        <li><a href="/kAIxu/pricing.html">Pricing</a></li>
        <li><a href="/kAIxu/trust.html">Trust &amp; Safety</a></li>
        <li><a href="/kAIxu/RequestKaixuAPIKey.html">Request API Key</a></li>
      </ul>
    </div>

    <div class="mega-nav-col">
      <h3>Platforms &amp; Apps</h3>
      <ul>
        <li><a href="/platforms.html">All Platforms</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/SkyeChat.html">SkyeChat</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/NexusForge.html">NexusForge</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/NexusOperator.html">NexusOperator</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/KaixuPush.html">KaixuPush</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/kAIxuAppForge.html">kAIxu AppForge</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/SkyeOfferForge.html">SkyeOfferForge</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/SkyeKIDE.html">SkyeKIDE</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/SkyePortalVault.html">SkyePortalVault</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/easyPWA.html">easyPWA</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/BusinessLaunchKit.html">Business Launch Kit</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/LocalSeoSnapshot.html">Local SEO Snapshot</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/DGUI.html">DGUI</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/SovereignVariables.html">Sovereign Variables</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/ConnectLog.html">ConnectLog</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeLeadVault.html">SkyeLeadVault</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeOpsConsole.html">SkyeOpsConsole</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/ZetaLinx.html">ZetaLinx</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeSplitEngine.html">SkyeSplitEngine</a></li>
        <li><a href="/Platforms-Apps-Infrastructure/2026/Offline First Tools/KaiLine.html">KaiLine</a></li>
      </ul>
    </div>

    <div class="mega-nav-col">
      <h3>Company</h3>
      <ul>
        <li><a href="/about.html">About</a></li>
        <li><a href="/credibility.html">Credibility</a></li>
        <li><a href="/leadership/index.html">Leadership</a></li>
        <li><a href="/leadership/SkyesOverLondon.html">Skye&#8217;s Over London</a></li>
        <li><a href="/leadership/dakayla-clark.html">DaKayla Clark</a></li>
        <li><a href="/divisions/index.html">Divisions</a></li>
        <li><a href="/directory/index.html">Directory</a></li>
        <li><a href="/resources/index.html">Resources</a></li>
        <li><a href="/account/index.html">Account</a></li>
        <li><a href="/members/index.html">Member Hub</a></li>
        <li><a href="/gateway/dashboard.html">Gateway Dashboard</a></li>
      </ul>
      <h3 style="margin-top:1rem">Blog</h3>
      <ul>
        <li><a href="/blog.html">All Posts</a></li>
        <li><a href="/Blogs/PhoenixValleyBlogHome.html">Phoenix Valley</a></li>
        <li><a href="/Blogs/In The SkyeLight/">In The SkyeLight</a></li>
        <li><a href="/Blogs/Houston Texas Devs &amp; AI/">Houston Devs &amp; AI</a></li>
        <li><a href="/Blogs/Editorials/">Editorials</a></li>
      </ul>
      <h3 style="margin-top:1rem">Legal</h3>
      <ul>
        <li><a href="/privacy.html">Privacy Policy</a></li>
        <li><a href="/terms.html">Terms of Service</a></li>
        <li><a href="/sitemap-visual.html">Sitemap</a></li>
      </ul>
    </div>

  </div>
</div>'''

def find_mega_nav_bounds(content):
    marker = 'id="megaNav"'
    idx = content.find(marker)
    if idx == -1:
        return -1, -1
    # walk back to find opening <div
    start = content.rfind('<div', 0, idx + len(marker))
    if start == -1:
        return -1, -1
    depth = 0
    i = start
    while i < len(content):
        if content[i:i+4] == '<div':
            depth += 1
            i += 4
        elif content[i:i+6] == '</div>':
            depth -= 1
            i += 6
            if depth == 0:
                return start, i
        else:
            i += 1
    return start, -1

stale_files = [
    './Valley Verified /MichoacanosTireShop.html',
    './Case Studies/index.html',
    './Platforms-Apps-Infrastructure/2026/kAIxuAppForge.html',
    './Platforms-Apps-Infrastructure/2026/SovereignVariables.html',
    './Platforms-Apps-Infrastructure/2026/SkyeOfferForge.html',
    './Platforms-Apps-Infrastructure/2026/DGUI.html',
    './Platforms-Apps-Infrastructure/2026/SkyeKIDE.html',
    './Platforms-Apps-Infrastructure/2026/BusinessLaunchKit.html',
    './Platforms-Apps-Infrastructure/2026/ExecSignIn.html',
    './Platforms-Apps-Infrastructure/2026/SignInPro.html',
    './Platforms-Apps-Infrastructure/2026/KaixuPush.html',
    './Platforms-Apps-Infrastructure/2026/NexusOperator.html',
    './Platforms-Apps-Infrastructure/2026/LocalSeoSnapshot.html',
    './Platforms-Apps-Infrastructure/2026/PlayPocketx-ActivityDeck.html',
    './Platforms-Apps-Infrastructure/2026/easyPWA.html',
    './Platforms-Apps-Infrastructure/2026/SkyePortalVault.html',
    './Platforms-Apps-Infrastructure/2026/NexusForge.html',
    './Platforms-Apps-Infrastructure/2026/SkyeChat.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/ConnectLog.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeLeadVault.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeOpsConsole.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/ZetaLinx.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/SkyeSplitEngine.html',
    './Platforms-Apps-Infrastructure/2026/Offline First Tools/KaiLine.html',
    './Platforms-Apps-Infrastructure/2026/In The SkyeLight/WebPilePro.html',
    './Platforms-Apps-Infrastructure/2026/In The SkyeLight/GraySoleLAuncher.html',
    './Platforms-Apps-Infrastructure/2026/In The SkyeLight/ExecLedgerPro.html',
]

updated = 0
failed = 0
for fpath in stale_files:
    try:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        start, end = find_mega_nav_bounds(content)
        if start == -1 or end == -1:
            print(f'BOUNDS FAIL: {fpath} (start={start}, end={end})')
            failed += 1
            continue
        new_content = content[:start] + CANONICAL + content[end:]
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        updated += 1
        print(f'OK: {fpath}')
    except Exception as e:
        print(f'ERROR: {fpath}: {e}')
        failed += 1

print(f'\nUpdated: {updated}, Failed: {failed}')
