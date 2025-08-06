import { defaultColorMap } from 'lib/types/defaults/options';
import type { ColorMapValue, ColorMapKey, HexColor, MatugenColors } from 'lib/types/options';
import { getMatugenVariations } from './variations';
import { bash, dependencies, Notify, isAnImage } from 'lib/utils';
import options from 'options';
import icons from 'lib/icons';
import type { Variable } from 'types/variable';
const { scheme_type, contrast } = options.theme.matugen_settings;
const { matugen } = options.theme;

const updateOptColor = (color: HexColor, opt: Variable<HexColor>): void => {
    opt.value = color;
};

export async function generateMatugenColors(): Promise<MatugenColors | undefined> {
    if (!matugen.value || !dependencies('matugen')) {
        return;
    }
    const wallpaperPath = options.wallpaper.image.value;

    // hoist cmd so it is available in the catch recovery path
    const normalizedContrast = contrast.value > 1 ? 1 : contrast.value < -1 ? -1 : contrast.value;
    const cmd = `matugen image ${wallpaperPath} -t scheme-${scheme_type.value} --contrast ${normalizedContrast} --json hex`;

    try {
        if (!wallpaperPath.length || !isAnImage(wallpaperPath)) {
            Notify({
                summary: 'Matugen Failed',
                body: "Please select a wallpaper in 'Theming > General' first.",
                iconName: icons.ui.warning,
                timeout: 7000,
            });
            return;
        }

        const contents = await bash(cmd);

        // Normalize output by stripping common noise, keeping only lines that look like JSON or key:value
        const cleaned = contents
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .filter(l => !/^INFO[:\s]/i.test(l) && !/^WARN[:\s]/i.test(l) && !/^ERROR[:\s]/i.test(l))
            .filter(l => !/^\+\s/.test(l) && !/^\$/.test(l))
            .join('\n');

        // Extract JSON object or array robustly
        const firstObj = cleaned.indexOf('{');
        const lastObj = cleaned.lastIndexOf('}');
        const firstArr = cleaned.indexOf('[');
        const lastArr = cleaned.lastIndexOf(']');

        let jsonText = '';
        if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
            jsonText = cleaned.slice(firstObj, lastObj + 1);
        } else if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
            jsonText = cleaned.slice(firstArr, lastArr + 1);
        } else {
            const preview = cleaned.slice(0, 200);
            throw new Error(`Matugen output does not contain JSON braces. Output (first 200 chars): ${preview}`);
        }

        // Some shells may append color codes or stray characters; try a second-chance trim
        const parsed = JSON.parse(jsonText.trim());

        if (!parsed?.colors) {
            const preview = jsonText.trim().slice(0, 200);
            throw new Error(`Matugen JSON missing 'colors' field. JSON (first 200 chars): ${preview}`);
        }

        const mode = options.theme.matugen_settings.mode.value;
        const palette = parsed.colors[mode];
        if (!palette) {
            throw new Error(`Matugen JSON missing palette for mode '${mode}'. Available keys: ${Object.keys(parsed.colors)}`);
        }
        return palette as MatugenColors;
    } catch (error) {
        const errMsg = `An error occurred while generating matugen colors: ${error}`;
        console.error(errMsg);

        // Provide a concise notification to aid debugging
        Notify({
            summary: 'Matugen Failed',
            body: typeof error === 'string' ? error.slice(0, 200) : `${(error as Error).message}`.slice(0, 200),
            iconName: icons.ui.warning,
            timeout: 7000,
        });
        return;
    }
}

const isColorValid = (color: string): color is ColorMapKey => {
    return Object.prototype.hasOwnProperty.call(defaultColorMap, color);
};

export const replaceHexValues = (incomingHex: HexColor, matugenColors: MatugenColors): HexColor => {
    if (!options.theme.matugen.value) {
        return incomingHex;
    }

    const matugenVariation = getMatugenVariations(matugenColors, options.theme.matugen_settings.variation.value);
    updateOptColor(matugenVariation.base, options.theme.bar.menus.menu.media.card.color as Variable<HexColor>);

    for (const curColor of Object.keys(defaultColorMap)) {
        const currentColor: string = curColor;
        if (!isColorValid(currentColor)) {
            continue;
        }

        const curColorValue: ColorMapValue = defaultColorMap[currentColor];
        if (curColorValue === incomingHex) {
            return matugenVariation[currentColor];
        }
    }

    return incomingHex;
};
