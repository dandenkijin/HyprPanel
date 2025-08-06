import Widget from 'resource:///com/github/Aylur/ags/widget.js';
const { Box, Button, Label, Icon } = Widget;
import type TLPType from '../../../services/tlp';
import { execAsync } from 'resource:///com/github/Aylur/ags/utils.js';

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
    
    const ProfileButton = (profile: Profile) => {
        const isActive = tlp.activeProfile === profile.name;
        const isLoading = loadingStates.get(profile.name) || false;
        
        const iconWidget = Box({
            className: 'menu-button-icon',
            children: [
                isLoading 
                    ? Box({
                        className: 'spinner',
                        children: [
                            Label({
                                label: '⟳',
                            })
                        ]
                    })
                    : Box({
                        className: 'icon-container',
                        children: [
                            Icon({
                                icon: profile.icon,
                                size: 24,
                                className: 'tlp-profile-icon',
                                setup: (self) => {
                                    // Fallback to text if icon fails to load
                                    self.connect('notify::icon', (icon) => {
                                        if (!icon.icon) {
                                            console.error(`Failed to load icon: ${profile.icon}`);
                                            // Fallback to text representation
                                            try {
                                                const fallbackChar = profile.name === 'ac' ? '⚡' : 
                                                                   profile.name === 'battery' ? '🔋' : '💻';
                                                
                                                const parent = self.get_parent();
                                                if (parent) {
                                                    // Clear existing children
                                                    const children = parent.get_children() || [];
                                                    for (const child of children) {
                                                        try {
                                                            child.destroy();
                                                        } catch (e) {
                                                            console.error('Error destroying child:', e);
                                                        }
                                                    }
                                                    
                                                    // Add fallback label
                                                    const fallbackLabel = Label({
                                                        label: fallbackChar,
                                                        className: 'fallback-icon',
                                                    });
                                                    
                                                    try {
                                                        parent.add(fallbackLabel);
                                                    } catch (e) {
                                                        console.error('Error adding fallback label:', e);
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('Error in icon fallback:', e);
                                            }
                                            
                                            try {
                                                self.destroy();
                                            } catch (e) {
                                                console.error('Error destroying icon:', e);
                                            }
                                        }
                                    });
                                }
                            })
                        ]
                    })
            ]
        });

        return Button({
            className: `menu-button ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`,
            onClicked: async () => {
                if (isActive || isLoading) return;
                loadingStates.set(profile.name, true);
                const success = await tlp.setProfile(profile.name);
                loadingStates.set(profile.name, false);
                if (!success) {
                    execAsync([
                        'notify-send',
                        'Power Mode',
                        `Failed to switch to ${profile.displayName} mode`
                    ]).catch(console.error);
                }
            },
            child: Box({
                className: 'menu-button-content',
                children: [
                    iconWidget,
                    Label({
                        className: 'menu-button-label',
                        label: profile.displayName,
                    })
                ]
            }),
        });
    };

    // Format the current profile name for display
    const formatProfileName = (profile: TLPProfile): string => {
        if (profile === 'unknown') return 'Unknown';
        return profile.charAt(0).toUpperCase() + profile.slice(1);
    };

    return Box({
        className: 'menu-box',
        vertical: true,
        css: `
            min-width: 200px;
            
            .menu-button {
                padding: 12px 16px;
                border-radius: 8px;
                transition: background-color 0.2s ease-in-out;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .menu-button:hover {
                background-color: rgba(255, 255, 255, 0.05);
            }
            
            .menu-button.active {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .menu-button-icon {
                display: flex;
                justify-content: center;
                align-items: center;
                min-width: 24px;
            }
            
            .menu-button-label {
                font-size: 14px;
                font-weight: 500;
            }
            
            .icon-container {
                min-width: 24px;
                min-height: 24px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .tlp-profile-icon {
                font-size: 24px;
                min-width: 24px;
                min-height: 24px;
                color: @theme_fg_color;
                opacity: 0.9;
                transition: opacity 0.2s ease-in-out;
            }
            
            .menu-button:hover .tlp-profile-icon {
                opacity: 1;
            }
            
            .fallback-icon {
                font-size: 20px;
                min-width: 24px;
                min-height: 24px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .spinner {
                animation: spin 1s linear infinite;
                display: flex;
                justify-content: center;
                align-items: center;
                min-width: 24px;
                min-height: 24px;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `,
        children: [
            Box({
                className: 'menu-header',
                vertical: true,
                children: [
                    Label({
                        className: 'menu-header-label',
                        label: 'Power Mode',
                    }),
                    Label({
                        className: 'menu-header-subtitle',
                        label: `Current: ${formatProfileName(tlp.activeProfile)}`,
                    }),
                ],
            }),
            Box({
                className: 'menu-buttons',
                vertical: true,
                spacing: 8,
                children: profiles.map(profile => ProfileButton(profile)),
            }),
            ...(tlp.isAvailable ? [] : [Box({
                className: 'menu-error',
                vertical: true,
                children: [
                    Label({
                        className: 'menu-error-label',
                        label: 'Power management service not available',
                    }),
                    Label({
                        className: 'menu-error-hint',
                        label: 'Install TLP for full power management features',
                    }),
                ],
            })]),
        ],
    });
};

export default TLP;
