import Widget from 'resource:///com/github/Aylur/ags/widget.js';
const { Box, Button, Label, Icon } = Widget;
import type TLPType from '../../../services/tlp';
import { execAsync } from 'resource:///com/github/Aylur/ags/utils.js';

// Define proper widget types
type GtkWidget = ReturnType<typeof Widget['Box']>;

type TLPProfile = 'ac' | 'battery' | 'usb' | 'unknown';

interface Profile {
    name: TLPProfile;
    displayName: string;
    icon: string;
}

const TLP = (tlp: typeof TLPType) => {
    const profiles: Profile[] = [
        { name: 'ac', displayName: 'AC Power', icon: 'ac-adapter' },
        { name: 'battery', displayName: 'Battery', icon: 'battery-full' },
        { name: 'usb', displayName: 'USB Power', icon: 'usb' },
    ];

    // Track loading state for each profile button
    const loadingStates = new Map<string, boolean>();

    // Shared builder to create a "menu-button" consistent with other menus
    const ProfileButton = (profile: Profile) => {
        const isActive = tlp.activeProfile === profile.name;
        const isLoading = loadingStates.get(profile.name) || false;

        return Button({
            className: `menu-button power-profile-item energy ${isActive ? 'active' : ''}`,
            onClicked: async () => {
                if (isActive || isLoading) return;
                loadingStates.set(profile.name, true);
                const success = await tlp.setProfile(profile.name);
                loadingStates.set(profile.name, false);
                if (!success) {
                    execAsync([
                        'notify-send',
                        'Power Mode',
                        `Failed to switch to ${profile.displayName} mode`,
                    ]).catch(console.error);
                }
            },
            child: Box({
                className: 'menu-item-box',
                children: [
                    // Left icon/spinner column
                    isLoading
                        ? Label({
                              label: '⟳',
                              className: 'menu-button-icon spinning',
                          })
                        : Icon({
                              className: 'menu-button-icon',
                              icon: profile.icon,
                              size: 16,
                          }),
                    // Name
                    Label({
                        className: 'menu-button-name',
                        label: profile.displayName,
                        hexpand: true,
                        xalign: 0,
                    }),
                ],
            }),
        });
    };

    // Format the current profile name for display
    const formatProfileName = (profile: TLPProfile): string => {
        switch (profile) {
            case 'ac':
                return 'AC Power';
            case 'battery':
                return 'Battery';
            case 'usb':
                return 'USB PD';
            case 'unknown':
                return 'Unknown';
            default:
                return 'Unknown';
        }
    };

    // Get the current power source information
    const getPowerSourceInfo = (): { icon: string; description: string } => {
        const profile = tlp.activeProfile;

        switch (profile) {
            case 'ac':
                return {
                    icon: 'ac-adapter',
                    description: 'Connected to AC power',
                };
            case 'usb':
                return {
                    icon: 'usb',
                    description: 'Connected via USB PD',
                };
            case 'battery':
                return {
                    icon: 'battery-full',
                    description: 'Running on battery',
                };
            default:
                return {
                    icon: 'battery-missing',
                    description: 'Power source unknown',
                };
        }
    };

    const header = Box({
        className: 'menu-section-container energy',
        vertical: true,
        children: [
            Box({
                className: 'menu-label-container',
                child: Box({
                    className: 'menu-label',
                    spacing: 8,
                    children: [
                        Icon({
                            className: 'menu-button-icon',
                            icon: getPowerSourceInfo().icon,
                            size: 16,
                        }),
                        Label({
                            className: 'menu-label',
                            label: 'Power Source',
                        }),
                    ],
                }),
            }),
            Box({
                className: 'menu-items-section',
                child: Box({
                    className: 'menu-active-container',
                    children: [
                        Label({
                            className: 'menu-label-dim',
                            label: 'Status',
                        }),
                        Label({
                            className: 'menu-active',
                            label: getPowerSourceInfo().description,
                            hexpand: true,
                            xalign: 0,
                        }),
                    ],
                }),
            }),
        ],
    });

    const list = Box({
        className: 'menu-section-container energy',
        vertical: true,
        children: [
            Box({
                className: 'menu-label-container',
                child: Label({
                    className: 'menu-label',
                    label: 'Power Profiles',
                    xalign: 0,
                }),
            }),
            Box({
                className: 'menu-items-section',
                vertical: true,
                children: profiles.map((p) => ProfileButton(p)),
            }),
        ],
    });

    const container = Box({
        className: 'menu-section-container energy',
        vertical: true,
        children: [header, list, ...(tlp.isAvailable ? [] : [
            Box({
                className: 'menu-items-section',
                vertical: true,
                children: [
                    Label({
                        className: 'menu-label',
                        label: 'Service Unavailable',
                    }),
                    Label({
                        className: 'menu-label-dim',
                        label: 'Install TLP for full power management features',
                    }),
                ],
            }),
        ])],
    });

    // Listen for profile changes and update the UI
    tlp.connect('profile-changed', () => {
        // Update header description text
        const info = getPowerSourceInfo();

        // header -> [menu-label-container, menu-items-section]
        const headerSection = container.children?.[0] as GtkWidget | undefined;
        const headerContent = headerSection?.children?.[1] as GtkWidget | undefined;
        const activeRow = headerContent?.children?.[0] as GtkWidget | undefined;
        const activeValue = activeRow?.children?.[1] as unknown as { label: string } | undefined;
        if (activeValue && typeof activeValue.label === 'string') {
            activeValue.label = info.description;
        }

        // Update active styles in profile list
        const listSection = container.children?.[1] as GtkWidget | undefined;
        const listItemsSection = listSection?.children?.[1] as GtkWidget | undefined;
        for (const child of listItemsSection?.children || []) {
            const btn = child as GtkWidget & {
                className?: string;
                toggleClassName?: (cls: string, state: boolean) => void;
                child?: { children?: Array<{ label?: string }> };
            };

            // Button is the direct child, its label is at child.children[1]
            const labelText = btn.child?.children?.[1]?.label as string | undefined;
            if (!labelText) continue;

            const buttonProfile = profiles.find((p) => p.displayName === labelText);
            if (!buttonProfile) continue;

            const isActive = tlp.activeProfile === buttonProfile.name;
            btn.toggleClassName?.('active', isActive);
        }
    });

    return container;
};

export default TLP;
