import { ExtensionSettings } from '@project/common';

const defaults: ExtensionSettings = {
    displaySubtitles: true,
    recordMedia: true,
    screenshot: true,
    cleanScreenshot: true,
    cropScreenshot: true,
    bindPlay: true,
    bindAutoPause: true,
    bindToggleSubtitles: true,
    bindToggleSubtitleTrackInVideo: true,
    bindToggleSubtitleTrackInAsbplayer: true,
    bindSeekToSubtitle: true,
    bindSeekToBeginningOfCurrentSubtitle: true,
    bindSeekBackwardOrForward: true,
    bindAdjustOffsetToSubtitle: true,
    bindAdjustOffset: true,
    subsDragAndDrop: true,
    autoSync: false,
    lastLanguageSynced: '',
    subtitlePositionOffsetBottom: 75,
    asbplayerUrl: 'https://killergerbah.github.io/asbplayer/',
    lastThemeType: 'dark',
};

type SettingsKey = keyof ExtensionSettings;

export default class Settings {
    async getAll(): Promise<ExtensionSettings> {
        return this.get(Object.keys(defaults) as SettingsKey[]);
    }

    async get<K extends keyof ExtensionSettings>(keys: K[]): Promise<Pick<ExtensionSettings, K>> {
        let parameters: Partial<ExtensionSettings> = {};

        for (const key of keys) {
            parameters[key] = defaults[key];
        }

        return new Promise((resolve, reject) => {
            chrome.storage.local.get(parameters, (data) => {
                const result: any = {};

                for (const key in parameters) {
                    result[key] = data[key] ?? defaults[key as SettingsKey];
                }

                resolve(result);
            });
        });
    }

    async set(settings: Partial<ExtensionSettings>) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(settings, () => resolve(undefined));
        });
    }
}
