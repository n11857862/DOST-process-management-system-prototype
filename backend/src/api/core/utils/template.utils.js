
const simpleTemplateRender = (templateString, context, returnUndefinedOnFail = false) => {
    if (typeof templateString !== 'string') {
        return templateString;
    }
    if (!(templateString.startsWith('{{') && templateString.endsWith('}}'))) {
    }

    return templateString.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, path) => {
        if (!path) {
            console.warn(`[TEMPLATE_RENDER] Empty path in template string: "${match}".`);
            return returnUndefinedOnFail ? undefined : match;
        }
        const keys = path.split('.');
        let value = context;
        try {
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    console.warn(`[TEMPLATE_RENDER] Path "<span class="math-inline">\{path\}" \(from template "</span>{match}") not fully resolved in context.`);
                    return returnUndefinedOnFail ? undefined : match;
                }
            }
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value, null, 2);
            }
            return (value !== undefined && value !== null) ? String(value) : '';
        } catch (e) {
            console.error(`[TEMPLATE_RENDER] Error resolving path "<span class="math-inline">\{path\}" \(from template "</span>{match}"):`, e);
            return returnUndefinedOnFail ? undefined : match;
        }
    });
};

module.exports = {
    simpleTemplateRender,
};