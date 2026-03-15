type Dictionary = Record<string, string>

const defaultLang_ = 'en'

const dictionaries_: Record<string, Dictionary> = {
  en: {
    __name: 'English',
  },
}

let dictionary_: Dictionary = dictionaries_[defaultLang_]

const setDictionary = (lang: string, dict: Dictionary): void => {
  dictionaries_[lang] = dict
}

const setLanguage = (lang: string): void => {
  dictionary_ = dictionaries_[lang]
}

const getLocalizedString = (text: string, ...args: any[]): string => {
  const translation = dictionary_[text] || text

  return translation.replace(/{(\d+)}/g, (match, number) => {
    return typeof args[number] != 'undefined' ? args[number] : match
  })
}

export default {
  setDictionary,
  setLanguage,
  getLocalizedString,
  __: getLocalizedString,
}
