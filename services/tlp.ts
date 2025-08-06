import { execAsync } from 'resource:///com/github/Aylur/ags/utils.js';
import Service from 'resource:///com/github/Aylur/ags/service.js';
import GLib from 'gi://GLib';

type TLPProfile = 'ac' | 'battery' | 'usb' | 'unknown';

class TLP extends Service {
    static {
        Service.register(TLP, {
            'profile-changed': ['string'],
            // 'changed' is a generic signal with no args in AGS; keep it zero-arg to match runtime expectations
        });
    }

    #isTLPAvailable = false;
    #activeProfile: TLPProfile = 'unknown';
    #requestedProfile: TLPProfile | null = null;
    #powerSourcePaths = [
        // Common AC adapter paths
        '/sys/class/power_supply/AC/online',
        '/sys/class/power_supply/ACAD/online',
        '/sys/class/power_supply/ADP1/online',
        // USB PD paths
        '/sys/class/power_supply/ADP0/online',
        '/sys/class/power_supply/usb/online',
        '/sys/class/power_supply/usb1/online',
        '/sys/class/power_supply/typec/online',
    ];
    #batteryStatusPaths = [
        '/sys/class/power_supply/BAT0/status',
        '/sys/class/power_supply/BAT1/status',
    ];
    #batteryCapacityPaths = [
        '/sys/class/power_supply/BAT0/capacity',
        '/sys/class/power_supply/BAT1/capacity',
    ];

    constructor() {
        super();
        this.#checkTLP().catch(console.error);
        
        // Update every 15 seconds for better responsiveness
        GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            15,
            () => {
                this.#updateProfile().catch(console.error);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    get activeProfile(): TLPProfile {
        return this.#activeProfile;
    }

    get isAvailable(): boolean {
        return this.#isTLPAvailable;
    }

    #tryReadFiles(paths: string[]): string {
        for (const path of paths) {
            try {
                const [success, contents] = GLib.file_get_contents(path);
                if (success) {
                    return new TextDecoder().decode(contents).trim();
                }
            } catch (error) {
                // Try next path
            }
        }
        return '';
    }

    async #execCommand(command: string): Promise<string> {
        try {
            const result = await execAsync([
                'bash',
                '-c',
                `command -v tlp >/dev/null && ${command} || echo "TLP_NOT_INSTALLED"`
            ]);
            return result.trim();
        } catch (error) {
            console.error(`Command failed: ${command}`, error);
            throw error;
        }
    }

    async setProfile(profile: TLPProfile): Promise<boolean> {
        if (!this.#isTLPAvailable) {
            console.error('TLP service not available');
            return false;
        }

        try {
            let command = '';
            switch (profile) {
                case 'ac':
                    command = 'sudo -n tlp ac';
                    break;
                case 'battery':
                    command = 'sudo -n tlp bat';
                    break;
                case 'usb':
                    command = 'sudo -n tlp usb';
                    break;
                default:
                    return false;
            }

            const result = await this.#execCommand(command);
            if (result === 'TLP_NOT_INSTALLED') {
                console.error('TLP is not installed. Please install TLP for power management.');
                return false;
            }

            this.#requestedProfile = profile;
            // Update immediately to reflect the change
            await this.#updateProfile();

            // Clear the requested profile after reflecting it, so auto-detect can resume
            this.#requestedProfile = null;
            return true;
        } catch (error) {
            console.error('Failed to set TLP profile:', error);
            return false;
        }
    }

    async #checkTLP(): Promise<boolean> {
        try {
            // First check if we can read power source info
            const acOnline = this.#tryReadFiles(this.#powerSourcePaths);
            if (acOnline === '') {
                console.warn('Cannot read power source status from any known path');
                this.#isTLPAvailable = false;
                return false;
            }

            // Then check if TLP is installed and we can execute it
            try {
                // Try common TLP binary locations
                const tlpPaths = [
                    '/usr/sbin/tlp-stat',
                    '/usr/bin/tlp-stat',
                    '/sbin/tlp-stat',
                    '/bin/tlp-stat'
                ];

                let tlpFound = false;
                for (const path of tlpPaths) {
                    try {
                        const [success] = GLib.spawn_command_line_sync(`${path} -v`);
                        if (success) {
                            tlpFound = true;
                            console.log(`Found TLP at: ${path}`);
                            break;
                        }
                    } catch (e) {
                        // Try next path - no need for continue as it's the last statement in the loop
                    }
                }

                if (!tlpFound) {
                    // As a fallback, try using 'which' to find tlp-stat
                    try {
                        const [success, stdout] = GLib.spawn_command_line_sync('which tlp-stat');
                        if (success && stdout) {
                            const path = new TextDecoder().decode(stdout).trim();
                            if (path) {
                                tlpFound = true;
                                console.log(`Found TLP via which: ${path}`);
                            }
                        }
                    } catch (e) {
                        // which command failed, continue
                    }
                }

                if (!tlpFound) {
                    console.warn('TLP is not installed or not in PATH. Some power management features will be limited.');
                    this.#isTLPAvailable = false;
                    return false;
                }

                // If we get here, TLP is available
                this.#isTLPAvailable = true;
                await this.#updateProfile();
                return true;

            } catch (error) {
                console.warn('Error checking TLP status:', error);
                this.#isTLPAvailable = false;
                return false;
            }
        } catch (error) {
            console.error('TLP check failed:', error);
            this.#isTLPAvailable = false;
            this.#activeProfile = 'unknown';
            this.emit('changed');
            return false;
        }
    }

    async #updateProfile(): Promise<void> {
        if (!this.#isTLPAvailable) {
            const prev = this.#activeProfile;
            this.#activeProfile = 'unknown';
            if (prev !== this.#activeProfile) {
                // profile-changed requires one arg
                this.emit('profile-changed', this.#activeProfile);
            }
            // changed must be emitted with ZERO args (per runtime error)
            this.emit('changed');
            return;
        }

        // Check if we have a manually requested profile
        if (this.#requestedProfile) {
            const prev = this.#activeProfile;
            this.#activeProfile = this.#requestedProfile;
            if (prev !== this.#activeProfile) {
                this.emit('profile-changed', this.#activeProfile);
            }
            this.emit('changed');
            return;
        }

        try {
            // Read power source and battery status
            const acOnline = this.#tryReadFiles(this.#powerSourcePaths) === '1';
            const batteryStatus = (this.#tryReadFiles(this.#batteryStatusPaths) || '').toLowerCase();
            const batteryCapacity = Number.parseInt(this.#tryReadFiles(this.#batteryCapacityPaths), 10) || 0;

            console.log(`Power source - AC: ${acOnline}, Battery: ${batteryStatus} ${batteryCapacity}%`);
            
            // If we have a requested profile, use that instead of auto-detection
            if (this.#requestedProfile) {
                this.#activeProfile = this.#requestedProfile;
                this.emit('changed');
                return;
            }
            
            // Auto-detect profile based on power source
            let newProfile: TLPProfile = 'unknown';
            if (acOnline) {
                newProfile = 'ac';
            } else if (batteryStatus.includes('discharg')) {
                newProfile = 'battery';
            } else if (batteryStatus.includes('charg')) {
                newProfile = 'usb';
            }

            if (newProfile !== this.#activeProfile) {
                this.#activeProfile = newProfile;
                // Emit with argument to satisfy signal definition
                this.emit('profile-changed', this.#activeProfile);
                // 'changed' carries no args
                this.emit('changed');
            }
        } catch (error) {
            console.error('Error updating TLP profile:', error);
            const prev = this.#activeProfile;
            this.#activeProfile = 'unknown';
            if (prev !== this.#activeProfile) {
                this.emit('profile-changed', this.#activeProfile);
            }
            this.emit('changed');
        }
    }
}

export default new TLP();
