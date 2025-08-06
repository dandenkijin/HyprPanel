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
        // Use themed icon names known to exist on most icon themes
        { name: 'ac', displayName: 'AC Power', icon: 'ac-adapter-symbolic' },
        { name: 'battery', displayName: 'Battery', icon: 'battery-full-symbolic' },
        // Use a more widely available USB icon; plain 'usb' may not exist in your theme
        { name: 'usb', displayName: 'USB Power', icon: 'drive-removable-media-usb-symbolic' },
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
                        : (() => {
                              const iconWidget = Icon({
                                  className: 'menu-button-icon',
                                  icon: profile.icon,
                                  size: 16,
                              });
                              // Fallback to a guaranteed unicode label if the named icon is missing
                              iconWidget.connect('notify::icon', (icon) => {
                                  // When AGS cannot resolve a name, icon.icon becomes empty
                                  if (!icon.icon) {
                                      const parent = iconWidget.get_parent() as GtkWidget | null;
                                      if (parent) {
                                          const label = Label({
                                              className: 'menu-button-icon',
                                              label:
                                                  profile.name === 'ac'
                                                      ? '⚡'
                                                      : profile.name === 'battery'
                                                      ? '🔋'
                                                      : '🔌', // USB fallback glyph
                                          });
                                          parent.add(label);
                                          iconWidget.destroy();
                                      }
                                  }
                              });
                              return iconWidget;
                          })(),
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
                    // Generic power icon that exists broadly
                    icon: 'power-profile-performance',
                    description: 'Connected to AC power',
                };
            case 'usb':
                return {
                    // Prefer a more common removable/media icon
                    icon: 'media-removable',
                    description: 'Connected via USB PD',
                };
            case 'battery':
                return {
                    icon: 'battery',
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
                            // Ensure header icon uses symbolic too for correct recoloring
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

    // Refresh header and list based on current tlp state
    const refreshUI = () => {
        const info = getPowerSourceInfo();

        // header -> [menu-label-container, menu-items-section]
        const headerSection = container.children?.[0] as GtkWidget | undefined;
        const headerLabelContainer = headerSection?.children?.[0] as GtkWidget | undefined; // menu-label-container
        const headerLabelBox = headerLabelContainer?.children?.[0] as GtkWidget | undefined; // menu-label
        const headerIcon = headerLabelBox?.children?.[0] as GtkWidget & {
            icon?: string;
            connect?: (signal: string, cb: (iconObj: { icon?: string }) => void) => void;
            get_parent?: () => GtkWidget | null;
            destroy?: () => void;
        } | undefined;

        if (headerIcon && 'icon' in headerIcon) {
            // Try to set named icon first
            (headerIcon as unknown as { icon: string }).icon = info.icon;

            // Attach a fallback if the icon name is missing in the theme
            headerIcon.connect?.('notify::icon', (iconObj: { icon?: string }) => {
                if (!iconObj.icon) {
                    const parent = headerIcon.get_parent?.() as GtkWidget | null;
                    if (parent && 'remove' in parent && 'add' in parent) {
                        const fallback = Label({
                            className: 'menu-button-icon',
                            label: tlp.activeProfile === 'ac' ? '⚡' : tlp.activeProfile === 'battery' ? '🔋' : '🔌',
                        });
                        // Remove the broken icon and add the fallback label using the GTK container API
                        // @ts-ignore remove/add exist on GTK containers in AGS
                        (parent as unknown as { remove: (w: GtkWidget) => void; add: (w: GtkWidget) => void }).remove(headerIcon as unknown as GtkWidget);
                        // @ts-ignore see above
                        (parent as unknown as { remove: (w: GtkWidget) => void; add: (w: GtkWidget) => void }).add(fallback as unknown as GtkWidget);
                    }
                }
            });
        }

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

            const labelText = btn.child?.children?.[1]?.label as string | undefined;
            if (!labelText) continue;

            const buttonProfile = profiles.find((p) => p.displayName === labelText);
            if (!buttonProfile) continue;

            const isActive = tlp.activeProfile === buttonProfile.name;
            btn.toggleClassName?.('active', isActive);
        }
    };

    // Listen for both profile-changed and generic changed (service emits both in different paths)
    tlp.connect('profile-changed', refreshUI);
    tlp.connect('changed', refreshUI);

    return container;
};

export default TLP;

