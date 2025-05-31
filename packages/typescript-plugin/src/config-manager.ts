import { EventEmitter } from 'events';
import type ts from 'typescript/lib/tsserverlibrary';

const configurationEventName = 'configuration-changed';

export interface Configuration {
    enable: boolean;
    assumeIsSvelteProject: boolean;
    enableCivet: boolean;
    diagnostics: {
        enable: boolean;
    };
    userPreferences: ts.UserPreferences;
    features: {
        diagnostics: boolean | 'warn' | 'error';
        hover: boolean;
        completions: {
            enable: boolean;
            emmet: boolean;
        };
        definitions: boolean;
        references: boolean;
        documentSymbols: boolean;
        codeActions: {
            enable: boolean;
            frameworkAgnostic: boolean;
        };
        selectionRange: boolean;
        signatureHelp: boolean;
        semanticTokens: boolean;
    };
    civet?: {
        enable: boolean;
    };
}

export const defaultConfiguration: Configuration = {
    enable: true,
    assumeIsSvelteProject: false,
    enableCivet: false,
    diagnostics: {
        enable: true
    },
    userPreferences: {} as ts.UserPreferences,
    features: {
        diagnostics: true,
        hover: true,
        completions: {
            enable: true,
            emmet: true
        },
        definitions: true,
        references: true,
        documentSymbols: true,
        codeActions: {
            enable: true,
            frameworkAgnostic: true
        },
        selectionRange: true,
        signatureHelp: true,
        semanticTokens: true
    },
    civet: {
        enable: false // Default to false, will be enabled if Civet detected
    }
};

export class ConfigManager {
    private emitter = new EventEmitter();
    private config: Configuration = {
        enable: true,
        assumeIsSvelteProject: false,
        enableCivet: false
    };

    onConfigurationChanged(listener: (config: Configuration) => void) {
        this.emitter.on(configurationEventName, listener);
    }

    removeConfigurationChangeListener(listener: (config: Configuration) => void) {
        this.emitter.off(configurationEventName, listener);
    }

    isConfigChanged(config: Configuration) {
        // right now we only care about enable
        return config.enable !== this.config.enable || config.enableCivet !== this.config.enableCivet;
    }

    updateConfigFromPluginConfig(config: Configuration) {
        // TODO this doesn't work because TS will resolve/load files already before we get the config request,
        // which leads to TS files that use Svelte files getting all kinds of type errors
        // const shouldWaitForConfigRequest = config.global == true;
        // const enable = config.enable ?? !shouldWaitForConfigRequest;
        this.config = {
            ...this.config,
            ...config
        };
        this.emitter.emit(configurationEventName, config);
    }

    getConfig() {
        return this.config;
    }

    updateEnableCivet(enable: boolean) {
        if (this.config.enableCivet !== enable) {
            this.config = { ...this.config, enableCivet: enable };
            this.emitter.emit(configurationEventName, this.config);
        }
    }
}
