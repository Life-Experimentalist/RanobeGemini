import re

def main():
    with open('src/popup/popup.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Find the saveSettingsBtn event listener
    # Let's replace the top portion of the saveSettingsBtn listener to handle null modelSelect
    match = re.search(r'(saveSettingsBtn\.addEventListener\("click", async \(\) => \{)(.*?)(const selectedModelId = modelSelect\.value;)', js, re.DOTALL)
    if match:
        replacement = match.group(1) + match.group(2) + "const selectedModelId = modelSelect?.value || '';"
        js = js.replace(match.group(0), replacement)
        print("Updated saveSettingsBtn")
    else:
        print("Could not find saveSettingsBtn listener")

    # Add openLibrarySettingsLink event listener at the end of initializePopup
    # Let's find the end of initializePopup() function
    # It might be hard to find reliably, let's just add it before the end of the file or near the setupResizing() call
    setup_resizing_idx = js.find('setupResizing();')
    if setup_resizing_idx != -1:
        new_code = '''
	const openLibrarySettingsLink = document.getElementById("openLibrarySettingsLink");
	if (openLibrarySettingsLink) {
		openLibrarySettingsLink.addEventListener("click", (e) => {
			e.preventDefault();
			browser.tabs.create({ url: browser.runtime.getURL("src/library/library-settings.html") });
		});
	}

	setupResizing();'''
        js = js.replace('setupResizing();', new_code)
        print("Added openLibrarySettingsLink")
    else:
        print("Could not find setupResizing()")

    with open('src/popup/popup.js', 'w', encoding='utf-8') as f:
        f.write(js)

if __name__ == '__main__':
    main()
