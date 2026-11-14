/**
 * Normalization tests for English Vocab Tracker.
 * Tests the normalization module against a curated list of ~100 words.
 */

import { describe, it, expect } from 'vitest';
import { normalize, normalizeBatch } from '../../src/tracker/normalize';
import { NORMALIZATION_TEST_CASES } from './test-data';

describe('Normalization', () => {
  describe('Basic cleanup', () => {
    it('should trim whitespace', () => {
      expect(normalize('  hello  ')).toBe('hello');
    });

    it('should lowercase', () => {
      expect(normalize('Hello')).toBe('hello');
      expect(normalize('HELLO')).toBe('hello');
    });

    it('should strip punctuation', () => {
      expect(normalize('hello!')).toBe('hello');
      expect(normalize('hello.')).toBe('hello');
      expect(normalize('hello,')).toBe('hello');
      expect(normalize('"hello"')).toBe('hello');
      expect(normalize("'hello'")).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(normalize('')).toBe('');
      expect(normalize('   ')).toBe('');
    });
  });

  describe('Suffix rules', () => {
    it('should handle -s suffix', () => {
      expect(normalize('cats')).toBe('cat');
      expect(normalize('dogs')).toBe('dog');
    });

    it('should handle -es suffix', () => {
      expect(normalize('buses')).toBe('bus');
      expect(normalize('boxes')).toBe('box');
    });

    it('should handle -ed suffix', () => {
      expect(normalize('walked')).toBe('walk');
      expect(normalize('played')).toBe('play');
    });

    it('should handle -ing suffix', () => {
      expect(normalize('walking')).toBe('walk');
      expect(normalize('playing')).toBe('play');
    });

    it('should handle -ly suffix', () => {
      expect(normalize('quickly')).toBe('quick');
      expect(normalize('happily')).toBe('happy');
    });

    it('should handle doubling (stop -> stopped)', () => {
      expect(normalize('stopped')).toBe('stop');
      expect(normalize('stopping')).toBe('stop');
    });

    it('should handle y -> ied (study -> studied)', () => {
      expect(normalize('studied')).toBe('study');
      expect(normalize('studies')).toBe('study');
    });

    it('should handle y -> ies (city -> cities)', () => {
      expect(normalize('cities')).toBe('city');
      expect(normalize('babies')).toBe('baby');
    });

    it('should handle o -> oes (potato -> potatoes)', () => {
      expect(normalize('potatoes')).toBe('potato');
      expect(normalize('tomatoes')).toBe('tomato');
    });
  });

  describe('Irregular verbs', () => {
    it('should normalize go/went/gone to go', () => {
      expect(normalize('go')).toBe('go');
      expect(normalize('goes')).toBe('go');
      expect(normalize('went')).toBe('go');
      expect(normalize('gone')).toBe('go');
      expect(normalize('going')).toBe('go');
    });

    it('should normalize take/took/taken to take', () => {
      expect(normalize('take')).toBe('take');
      expect(normalize('takes')).toBe('take');
      expect(normalize('took')).toBe('take');
      expect(normalize('taken')).toBe('take');
    });

    it('should normalize see/saw/seen to see', () => {
      expect(normalize('see')).toBe('see');
      expect(normalize('sees')).toBe('see');
      expect(normalize('saw')).toBe('see');
      expect(normalize('seen')).toBe('see');
    });

    it('should normalize be/am/is/are/was/were/been/being to be', () => {
      expect(normalize('be')).toBe('be');
      expect(normalize('is')).toBe('be');
      expect(normalize('am')).toBe('be');
      expect(normalize('are')).toBe('be');
      expect(normalize('was')).toBe('be');
      expect(normalize('were')).toBe('be');
      expect(normalize('been')).toBe('be');
      expect(normalize('being')).toBe('be');
    });

    it('should normalize have/has/had/having to have', () => {
      expect(normalize('have')).toBe('have');
      expect(normalize('has')).toBe('have');
      expect(normalize('had')).toBe('have');
      expect(normalize('having')).toBe('have');
    });

    it('should normalize do/does/did/done/doing to do', () => {
      expect(normalize('do')).toBe('do');
      expect(normalize('does')).toBe('do');
      expect(normalize('did')).toBe('do');
      expect(normalize('done')).toBe('do');
      expect(normalize('doing')).toBe('do');
    });

    it('should normalize make/made to make', () => {
      expect(normalize('make')).toBe('make');
      expect(normalize('makes')).toBe('make');
      expect(normalize('made')).toBe('make');
    });

    it('should normalize know/knew/known to know', () => {
      expect(normalize('know')).toBe('know');
      expect(normalize('knows')).toBe('know');
      expect(normalize('knew')).toBe('know');
      expect(normalize('known')).toBe('know');
    });

    it('should normalize think/thought to think', () => {
      expect(normalize('think')).toBe('think');
      expect(normalize('thinks')).toBe('think');
      expect(normalize('thought')).toBe('think');
    });
  });

  describe('Irregular nouns', () => {
    it('should normalize child/children to child', () => {
      expect(normalize('child')).toBe('child');
      expect(normalize('children')).toBe('child');
    });

    it('should normalize man/men to man', () => {
      expect(normalize('man')).toBe('man');
      expect(normalize('men')).toBe('man');
    });

    it('should normalize woman/women to woman', () => {
      expect(normalize('woman')).toBe('woman');
      expect(normalize('women')).toBe('woman');
    });

    it('should normalize person/people to person', () => {
      expect(normalize('person')).toBe('person');
      expect(normalize('people')).toBe('person');
    });

    it('should normalize tooth/teeth to tooth', () => {
      expect(normalize('tooth')).toBe('tooth');
      expect(normalize('teeth')).toBe('tooth');
    });

    it('should normalize foot/feet to foot', () => {
      expect(normalize('foot')).toBe('foot');
      expect(normalize('feet')).toBe('foot');
    });

    it('should normalize mouse/mice to mouse', () => {
      expect(normalize('mouse')).toBe('mouse');
      expect(normalize('mice')).toBe('mouse');
    });

    it('should normalize goose/geese to goose', () => {
      expect(normalize('goose')).toBe('goose');
      expect(normalize('geese')).toBe('goose');
    });
  });

  describe('Multi-word phrases', () => {
    it('should pass through multi-word phrases untouched', () => {
      expect(normalize('give up')).toBe('give up');
      expect(normalize('Take Off')).toBe('take off');
      expect(normalize('TURN ON')).toBe('turn on');
    });

    it('should cleanup punctuation in multi-word phrases', () => {
      expect(normalize('give up!')).toBe('give up');
      expect(normalize('"take off"')).toBe('take off');
    });
  });

  describe('Batch normalization', () => {
    it('should normalize multiple words', () => {
      const words = ['walked', 'played', 'going', 'children'];
      const normalized = normalizeBatch(words);
      expect(normalized).toEqual(['walk', 'play', 'go', 'child']);
    });

    it('should handle empty array', () => {
      expect(normalizeBatch([])).toEqual([]);
    });
  });

  describe('Curated test list', () => {
    it('should pass all curated normalization tests', () => {
      for (const testCase of NORMALIZATION_TEST_CASES) {
        const result = normalize(testCase.input);
        expect(result).toBe(testCase.expectedLemma);
      }
    });
  });
});
