/** One sense of a dictionary entry: optional grammar note + the definition. */
export interface DictEntrySense {
  grammar: string;
  def: string;
}

/** The small plain object parseEntry extracts from an Oxford entry page. */
export interface DictEntry {
  headword: string;
  pos: string;
  phonBr: string;
  phonUs: string;
  audioUk: string;
  audioUs: string;
  level: string;
  levelList: string;
  senses: DictEntrySense[];
}

/** Parse the Oxford definition page into a small plain object. */
export function parseEntry(html: string): DictEntry | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const entry = doc.querySelector("div.entry");
  if (!entry) return null;

  const headword = entry.querySelector("h1.headword");
  const pos = entry.querySelector(".webtop .pos");
  const phonBr = entry.querySelector(".phons_br .phon");
  const phonUs = entry.querySelector(".phons_n_am .phon");
  const pronUk = entry.querySelector(".phons_br .sound.pron-uk");
  const pronUs = entry.querySelector(".phons_n_am .sound.pron-us");
  // CEFR level badge (only Oxford 3000/5000 words have it; OPAL spans have no level).
  const symSpan = entry.querySelector(
    ".webtop .symbols span[class^='ox3ksym_'], .webtop .symbols span[class^='ox5ksym_']"
  );
  let level = "";
  let levelList = "";
  if (symSpan) {
    const lm = (symSpan.className || "").match(/sym_([abc][12])/);
    if (lm) {
      level = lm[1]!.toUpperCase();
      levelList = symSpan.className.indexOf("ox5k") === 0 ? "Oxford 5000" : "Oxford 3000";
    }
  }

  // First senses list of the first entry (skips run-on blocks).
  const list = entry.querySelector("ol.senses_multiple, ol.sense_single");
  const senses: DictEntrySense[] = [];
  if (list) {
    for (const li of list.querySelectorAll("li.sense")) {
      // Skip senses nested inside another sense (subsenses) if any appear.
      if (li.parentElement && li.parentElement.closest("li.sense")) continue;
      const grammar = li.querySelector(".sensetop .grammar");
      const def = li.querySelector(".def");
      const defText = def ? def.textContent!.trim() : "";
      if (defText) {
        senses.push({
          grammar: grammar ? grammar.textContent!.trim() : "",
          def: defText
        });
      }
    }
  }

  if (!headword || senses.length === 0) return null;
  return {
    headword: headword.textContent!.trim(),
    pos: pos ? pos.textContent!.trim() : "",
    phonBr: phonBr ? phonBr.textContent!.trim() : "",
    phonUs: phonUs ? phonUs.textContent!.trim() : "",
    audioUk: pronUk ? pronUk.getAttribute("data-src-mp3") || "" : "",
    audioUs: pronUs ? pronUs.getAttribute("data-src-mp3") || "" : "",
    level,
    levelList,
    senses
  };
}
