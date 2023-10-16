import {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    BackgroundPageToExtensionCommand,
    BackgroundPageReadyMessage,
    AudioBase64Message,
    SettingsProvider,
    CopyMessage,
} from '@project/common';
import { Mp3Encoder } from '@project/common';
import AudioRecorder from './services/audio-recorder';
import { bufferToBase64 } from './services/base64';
import { i18nInit } from './ui/i18n';
import i18n from 'i18next';
import { fetchLocalization } from './services/localization-fetcher';
import { ExtensionSettingsStorage } from './services/extension-settings-storage';
import { CopyHistoryRepository } from '@project/common/app';
import { v4 as uuidv4 } from 'uuid';

const settings = new SettingsProvider(new ExtensionSettingsStorage());
const audioRecorder = new AudioRecorder();

const _sendAudioBase64 = async (base64: string, preferMp3: boolean) => {
    if (preferMp3) {
        const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
        const mp3Blob = await Mp3Encoder.encode(
            blob,
            () => new Worker(chrome.runtime.getURL('./mp3-encoder-worker.worker.js'))
        );
        base64 = bufferToBase64(await mp3Blob.arrayBuffer());
    }

    const command: BackgroundPageToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-background-page',
        message: {
            command: 'audio-base64',
            base64: base64,
        },
    };

    chrome.runtime.sendMessage(command);
};

window.onload = async () => {
    const listener = (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (request.sender === 'asbplayer-extension-to-background-page') {
            switch (request.message.command) {
                case 'start-recording-audio-with-timeout':
                    const startRecordingAudioWithTimeoutMessage =
                        request.message as StartRecordingAudioWithTimeoutMessage;
                    audioRecorder
                        .startWithTimeout(startRecordingAudioWithTimeoutMessage.timeout, () => sendResponse(true))
                        .then((audioBase64) =>
                            _sendAudioBase64(audioBase64, startRecordingAudioWithTimeoutMessage.preferMp3)
                        )
                        .catch((e) => {
                            console.error(e);
                            sendResponse(false);
                        });
                    return true;
                case 'start-recording-audio':
                    audioRecorder
                        .start()
                        .then(() => sendResponse(true))
                        .catch((e) => {
                            console.error(e);
                            sendResponse(false);
                        });
                    return true;
                case 'stop-recording-audio':
                    const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                    audioRecorder
                        .stop()
                        .then((audioBase64) => _sendAudioBase64(audioBase64, stopRecordingAudioMessage.preferMp3));
                    break;
                case 'copy':
                    const copyMessage = request.message as CopyMessage;
                    settings.getSingle('miningHistoryStorageLimit').then((storageLimit) => {
                        return new CopyHistoryRepository(storageLimit).save({
                            ...copyMessage.subtitle,
                            id: copyMessage.id ?? uuidv4(),
                            timestamp: Date.now(),
                            name:
                                copyMessage.subtitleFileName?.substring(
                                    0,
                                    copyMessage.subtitleFileName.lastIndexOf('.')
                                ) ?? '',
                            subtitleFileName: copyMessage.subtitleFileName ?? '',
                            mediaTimestamp: copyMessage.mediaTimestamp,
                            surroundingSubtitles: copyMessage.surroundingSubtitles,
                            url: copyMessage.url,
                            audio: copyMessage.audio,
                            image: copyMessage.image,
                        });
                    });
                    break;
            }
        }
    };
    chrome.runtime.onMessage.addListener(listener);

    window.addEventListener('beforeunload', (event) => {
        chrome.runtime.onMessage.removeListener(listener);
    });

    const readyCommand: BackgroundPageToExtensionCommand<BackgroundPageReadyMessage> = {
        sender: 'asbplayer-background-page',
        message: {
            command: 'background-page-ready',
        },
    };
    const acked = await chrome.runtime.sendMessage(readyCommand);

    if (!acked) {
        window.close();
    }

    const language = await settings.getSingle('language');
    const loc = await fetchLocalization(language);
    i18nInit(loc.lang, loc.strings);
    document.getElementById('helper-text')!.innerHTML = i18n.t('extension.backgroundAudioRecordingPage.description');
};