import ca from './ca.ts';
import de from './de.ts';
import eo from './eo.ts';
import es from './es.ts';
import fr from './fr.ts';
import hi from './hi.ts';
import id from './id.ts';
import it from './it.ts';
import ja from './ja.ts';
import ko from './ko.ts';
import nb from './nb.ts';
import pl from './pl.ts';
import pt from './pt.ts';
import ru from './ru.ts';
import sv from './sv.ts';
import tr from './tr.ts';
import zh from './zh.ts';

/**
 * The bundled translations of `uiStrings`, a table for each language, by key without `KEY_PREFIX`, in a file for each language. A text with a
 * count has a key for each plural category of the language. Words that Starlight translates, such as "Copied" and
 * "Next", follow Starlight's table for the language. Corrections from native speakers are welcome.
 */
export const languages: Record<string, Record<string, string>> = {
  ca,
  de,
  eo,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nb,
  pl,
  pt,
  ru,
  sv,
  tr,
  zh,
};

/**
 * More codes for a language's table. A site's `lang` must match a code exactly, because Starlight looks plugin
 * texts up only under the site's own code, with its region in capitals, such as `pt-BR`.
 */
export const languageAliases: Record<string, string[]> = {
  nb: ['no'],
  pt: ['pt-BR', 'pt-PT'],
  zh: ['zh-CN', 'zh-TW'],
};
