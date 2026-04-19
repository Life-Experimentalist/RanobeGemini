import re

def main():
    with open('src/popup/popup.html', 'r', encoding='utf-8') as f:
        html = f.read()

    new_config = '''<!-- Config Tab -->
		<div id="config" class="tab-content">
			<!-- Quick Settings -->
			<div class="config-section" id="incognito-section">
				<h3 class="config-section-title">⚡ Quick Settings</h3>
				<div class="config-section-content">
					<!-- Incognito -->
					<div class="config-item">
						<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:normal;">
							<input type="checkbox" id="incognitoEnabled" />
							<span>🕵️ Incognito Mode (Pause Tracking)</span>
						</label>
					</div>
					<!-- Theme Mode -->
					<div class="config-item">
						<label for="themeMode">Theme Mode</label>
						<select id="themeMode" style="width: 100%">
							<option value="dark">Dark Mode (Default)</option>
							<option value="light">Light Mode</option>
							<option value="auto">Auto (System Preference)</option>
						</select>
					</div>
					<!-- AI Provider -->
					<div class="config-item">
						<label for="aiProviderSelect">AI Provider</label>
						<select id="aiProviderSelect" style="width: 100%">
							<option value="gemini">Google Gemini</option>
							<option value="openai-compatible">OpenAI-Compatible</option>
							<option value="ollama">Ollama (Local)</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Site Toggles -->
			<details class="config-section">
				<summary style="padding: 12px 15px; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center">
					<span>🌐 Site Toggles</span>
					<span style="font-size: 11px; color: var(--text-secondary); font-weight: normal">Toggle sites</span>
				</summary>
				<div class="config-section-content" style="padding-top: 0">
					<div id="siteToggleList" class="site-toggle-list"></div>
				</div>
			</details>

			<!-- Advanced Settings CTA -->
			<div style="margin-top: 16px">
				<button id="saveSettings" style="width: 100%; padding: 10px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 12px; font-size: 14px">
					✅ Save Quick Settings
				</button>
				<a href="#" id="openLibrarySettingsLink" class="open-library-settings" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; text-decoration: none; color: var(--text-primary); transition: all 0.2s">
					<div style="display: flex; align-items: center; gap: 10px">
						<span style="font-size: 18px">⚙️</span>
						<div>
							<strong style="display: block; font-size: 12px">Advanced Settings</strong>
							<span style="font-size: 10px; color: var(--text-secondary)">API Keys, Drive Backup, Prompts</span>
						</div>
					</div>
					<span style="color: var(--text-secondary)">→</span>
				</a>
			</div>
		</div>
'''
    match = re.search(r'<!-- Config Tab -->.*?(?=<!-- Novels Tab -->)', html, re.DOTALL)
    if match:
        html = html.replace(match.group(0), new_config + '\n\t\t')
        with open('src/popup/popup.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print('Successfully replaced Config Tab')
    else:
        print('Could not find Config Tab')

if __name__ == '__main__':
    main()
