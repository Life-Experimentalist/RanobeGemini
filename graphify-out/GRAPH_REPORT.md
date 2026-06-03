# Graph Report - V:\Code\ProjectCode\RanobesGemini  (2026-06-02)

## Corpus Check
- 235 files · ~1,978,862 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2000 nodes · 5897 edges · 69 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 1519 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)
1. `debugError()` - 294 edges
2. `debugLog()` - 201 edges
3. `showStatusMessage()` - 51 edges
4. `NovelLibrary` - 46 edges
5. `initialize()` - 43 edges
6. `FanfictionHandler` - 43 edges
7. `handleEnhanceClick()` - 38 edges
8. `BaseWebsiteHandler` - 38 edges
9. `NovelbinHandler` - 35 edges
10. `init()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `initialize()` --calls--> `applyExtensionBridgeFlags()`  [INFERRED]
  V:\Code\ProjectCode\RanobesGemini\src\content\content.js → src\utils\extension-bridges.js
- `setupEventListeners()` --calls--> `bindModalSwipeNavigation()`  [INFERRED]
  V:\Code\ProjectCode\RanobesGemini\src\library\library.js → V:\Code\ProjectCode\RanobesGemini\src\library\shared-shelf-helpers.js
- `setupEventListeners()` --calls--> `bindTelemetryConsentHandlers()`  [INFERRED]
  V:\Code\ProjectCode\RanobesGemini\src\library\library.js → V:\Code\ProjectCode\RanobesGemini\src\library\telemetry-consent.js
- `debugError()` --calls--> `getGlobalTelemetryStats()`  [INFERRED]
  V:\Code\ProjectCode\RanobesGemini\src\utils\logger.js → V:\Code\ProjectCode\RanobesGemini\src\utils\telemetry.js
- `insertNodeAtContentTop()` --calls--> `insertAtContentTopRuntime()`  [INFERRED]
  V:\Code\ProjectCode\RanobesGemini\src\content\content.js → V:\Code\ProjectCode\RanobesGemini\src\content\modules\dom-integration.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (205): handleSummarizeClickRuntime(), BackupDownloadManager, createChunkControlRuntime(), handlePauseChunkRuntime(), handleSkipChunkRuntime(), addGeminiProcessedNotice(), addInitialWordCountDisplay(), addToNovelLibrary() (+197 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (157): addUrlsToLibrary(), applyLibraryTheme(), applyModalActionVisibility(), attachIconFallbacks(), attachWebsiteSettingsHandlers(), bindSettingsTabListeners(), buildStatusDropdownOptions(), checkFirstRunConsent() (+149 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (110): handleEnhanceClickRuntime(), handleAllChunksProcessedRuntime(), cleanupChunkedUiBeforeInitRuntime(), continueChunkEnhancementRuntime(), deleteAllChunksRuntime(), handleEnhancementCacheGateRuntime(), handleEnhancementCancelledRuntime(), handleEnhancementLifecycleErrorRuntime() (+102 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (101): ensureInitialRollingBackup(), createComprehensiveBackup(), createRollingBackup(), deleteRollingBackup(), detectBrowser(), downloadBackupAsFile(), getExtensionVersion(), getRollingBackup() (+93 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (16): escapeHtml(), getAO3Styles(), getBaseModalStyles(), getFanFictionStyles(), getNovelbinStyles(), getRanobesStyles(), getScribbleHubStyles(), AO3CardRenderer (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (82): applyConfig(), setText(), applyDisplaySettings(), applyFiltersAndSort(), applyFilterStateToUI(), applyShelfTheme(), buildFilterOptions(), buildFilterOptionsFromNovels() (+74 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (63): assertNoHardcodedSecretsInSource(), build(), clean(), copyDir(), copyFileWithRetries(), generateHandlerRegistry(), injectBuildSecrets(), main() (+55 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (2): BaseWebsiteHandler, NovelbinHandler

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (40): countWords(), extractParagraphs(), isHTML(), splitByParagraphs(), splitContentByWords(), splitPlainTextByWords(), validateChunkSize(), buildChunks() (+32 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (29): HandlerManager, matchesHostname(), HandlerSettings, getAllHandlers(), processMessage(), checkUpToDateNovels(), fetchFreshChapterCount(), getUserUpdateSettings() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (8): applyExtensionBridgeFlags(), normalizeReadingStatus(), readExtensionBridgeStatus(), FanfictionHandler, cleanupAllModules(), getModuleStatus(), initializeModules(), toggleModule()

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (45): clearTokens(), dbxRequest(), downloadDropboxBackup(), ensureDropboxAccessToken(), folderPrefix(), getContinuousDropboxBackup(), getDropboxConfig(), getLatestDropboxBackup() (+37 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (21): buildDateField(), buildHandlerFieldsHTML(), buildModalHTML(), buildNumberField(), buildReadingStatusSelect(), buildSelectField(), buildTagsSection(), buildTextareaField() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (38): buildFallbackOverride(), combinePartialSummaries(), combinePrompts(), createBackupFile(), endsLikeTruncatedText(), ensureProviderRegistry(), extractCandidateText(), getActiveProviderAdapter() (+30 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (40): syncLibraryFromDrive(), base64UrlEncode(), clearAuthError(), createDriveAuthError(), createPkcePair(), downloadDriveBackup(), enforceBackupLimit(), ensureBackupFolder() (+32 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (26): drawLeafShape(), getOrCreateCanvas(), getPrimaryColor(), handleBodyAttributeChange(), hexToRgb(), hideCanvas(), init(), loopFallingLeaves() (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (7): AO3Handler, formatExportFilename(), formatNovelInfo(), resolveExportExtension(), resolveExportTemplate(), resolveTemplate(), toFilenameSafe()

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (30): appendLog(), clearLogs(), downloadLogs(), exportLogsBlob(), flushQueue(), getLogs(), openDb(), scheduleFlush() (+22 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (25): evaluateChapterReadTransitions(), evaluateInactivityTransitions(), generateId(), getAllStatuses(), getBuiltInRules(), getDefaultRereadingOverlay(), matchesChapterReadConditions(), matchesFromStatus() (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (1): RanobesHandler

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (20): _assembleContext(), _buildResponse(), _callGemini(), _callOllama(), _callOpenAI(), _callProvider(), handler(), chronicleKey() (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (22): buildProjectKey(), bindTelemetryConsentHandlers(), checkFirstRunConsentRuntime(), detectBrowser(), generateInstallId(), getBadgeUrl(), getGlobalTelemetryStats(), getProjectViewStats() (+14 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (18): bindPwaInstallButton(), buildLibraryUrl(), detectBrowser(), detectExtension(), detectStandaloneMode(), fetchCounterJson(), formatMetricCount(), hideLibraryButton() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (20): collectFiles(), delay(), findLatestFile(), getPublishMode(), hasAllEnv(), main(), missingEnv(), publishChrome() (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (17): createTaxonomyEngine(), escapeHtml(), formatNumber(), getWorkStatusOrder(), loadSavedFilters(), normalizeModalStatus(), normalizeReadingStatus(), openNovelFromQuery() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.31
Nodes (10): c, d(), e(), f(), g(), h(), j(), k() (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.28
Nodes (10): bindModalSwipeDismiss(), bindModalSwipeNavigation(), buildImportUrlFromNovelId(), ensureRandomSelectButton(), openNovelFromQuery(), parseNovelIdIdentity(), recoverMissingNovelById(), sendAddToLibraryMessage() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (4): backupUrl(), getWebdavCredentials(), loadCredentials(), resolveBackupPath()

### Community 28 - "Community 28"
Cohesion: 0.32
Nodes (11): buildJsonPayload(), getChangedFiles(), getCommits(), main(), parseArgs(), readJsonAtCommit(), renderMarkdown(), renderText() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.35
Nodes (9): expandWildcards(), generateManifestMatches(), getSitePrompt(), isAO3Domain(), isFanfictionDomain(), isRanobesDomain(), isSupportedDomain(), isWebNovelDomain() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.45
Nodes (9): buildSummaryRequestKey(), collectContent(), findSummaryContainer(), getSummaryReferenceNode(), getSummaryReferenceStyles(), renderSummaryInContainer(), splitOversizedTextParts(), summariseLargeContent() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.46
Nodes (7): buildDashboard(), getHandlerCount(), groupByStatus(), main(), parseStatusEntries(), readJson(), toPieMermaid()

### Community 32 - "Community 32"
Cohesion: 0.57
Nodes (7): assertCanonicalSchemaEnvelope(), assertLandingProxyRef(), assertSampleBackup(), fail(), getRuntimeBackupVersion(), main(), readJson()

### Community 33 - "Community 33"
Cohesion: 0.54
Nodes (6): buildCollapsibleWrapper(), buildCustomTypesPromptFragment(), getReadAloudText(), renderCollapsibleSections(), resolveTypeMeta(), resolveTypeSettings()

### Community 34 - "Community 34"
Cohesion: 0.54
Nodes (7): handleChapterControlsToggleBanners(), applyStoredVisibilityRuntime(), getBannerSelector(), shouldBannersBeHiddenRuntime(), syncToggleButtons(), toggleBannerNodes(), toggleEnhancedBannersRuntime()

### Community 35 - "Community 35"
Cohesion: 0.43
Nodes (4): fetchVersion(), getVersionSource(), readCache(), writeCache()

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (3): initializeDebugPanel(), addDebugButton(), debugContentExtraction()

### Community 37 - "Community 37"
Cohesion: 0.53
Nodes (4): createDebugPanel(), formatTraceForDisplay(), updateStateContent(), updateTraceContent()

### Community 38 - "Community 38"
Cohesion: 0.6
Nodes (3): extractDomainsFromHandlers(), generateMatchPatterns(), updateManifest()

### Community 39 - "Community 39"
Cohesion: 0.6
Nodes (3): ensureArchiver(), getExtensionInfo(), packageSource()

### Community 40 - "Community 40"
Cohesion: 0.7
Nodes (3): pushLog(), setStatus(), setupTabs()

### Community 41 - "Community 41"
Cohesion: 0.8
Nodes (4): hasNonEmptyStaticArray(), hasOverride(), isFunction(), validateHandlerContractRuntime()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (1): sendKeepAlive()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (1): isCacheableRequest()

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (2): isFunction(), validateProviderAdapterRuntime()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): Fix garbled emoji in library-settings.html.

## Knowledge Gaps
- **1 isolated node(s):** `Fix garbled emoji in library-settings.html.`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 46`** (2 nodes): `Invoke-NodeRuntime()`, `commit-history-auto.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `main()`, `update_popup.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `main()`, `update_popup_js.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `isCoreAsset()`, `sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `storage-interface.js`, `validateStorageSyncAdapterRuntime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `createDropboxStorageAdapter()`, `dropbox-storage.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `createGoogleDriveStorageAdapter()`, `google-drive-storage.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `createOnedriveStorageAdapter()`, `onedrive-storage.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `build-version.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `renderer.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `renderer.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `renderer.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `renderer.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `plugin-registry.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `constants.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `handler-registry.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `check_braces.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `build-version.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `constants.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `handler-registry.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `Fix garbled emoji in library-settings.html.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `debugError()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 21`, `Community 30`, `Community 36`, `Community 42`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `debugLog()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 36`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 19`, `Community 21`, `Community 30`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Are the 288 inferred relationships involving `debugError()` (e.g. with `setupKeepAliveAlarm()` and `reconcileDriveBackupHistoryWithLiveFiles()`) actually correct?**
  _`debugError()` has 288 INFERRED edges - model-reasoned connections that need verification._
- **Are the 196 inferred relationships involving `debugLog()` (e.g. with `setupKeepAliveAlarm()` and `performAutoBackup()`) actually correct?**
  _`debugLog()` has 196 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `showStatusMessage()` (e.g. with `.add()` and `debugContentExtraction()`) actually correct?**
  _`showStatusMessage()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `initialize()` (e.g. with `debugLog()` and `getSiteSettings()`) actually correct?**
  _`initialize()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Fix garbled emoji in library-settings.html.` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._