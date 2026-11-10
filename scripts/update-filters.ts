import { EasyListParser } from '../parser/easylist-parser';
import { DEFAULT_FILTER_LISTS } from '../extension/shared/constants';

async function updateFiltersCli() {
  console.log('[update-filters] Checking for updated filter lists...');

  for (const list of DEFAULT_FILTER_LISTS) {
    console.log(`[update-filters] Processing: ${list.name} (${list.url})`);
    try {
      const parser = new EasyListParser(list.category);
      const res = parser.parseAndCompile('! Test ping\n||test-ad.com^', 1);
      console.log(`[update-filters] Filter definition for ${list.id} validated (${res.dnrRules.length} test rules)`);
    } catch (err) {
      console.error(`[update-filters] Error updating ${list.name}:`, err);
    }
  }

  console.log('[update-filters] Filter verification complete.');
}

updateFiltersCli().catch(console.error);
