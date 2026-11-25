import { describe, expect, it } from 'vitest';
import {
  ACTION_BAR_LOCK_MS,
  ACTION_BAR_THRESHOLD,
  SCROLL_HINT_TOLERANCE,
  hasHiddenContent,
  initialActionBarState,
  nextActionBarState,
  type ActionBarState,
} from './action-bar.js';

const NOW = 10_000;

function visible(anchor: number, lockUntil = 0): ActionBarState {
  return { hidden: false, anchor, lockUntil };
}

function hidden(anchor: number, lockUntil = 0): ActionBarState {
  return { hidden: true, anchor, lockUntil };
}

describe('constantes', () => {
  it('reprennent les valeurs de la spécification', () => {
    expect(ACTION_BAR_THRESHOLD).toBe(24);
    expect(ACTION_BAR_LOCK_MS).toBe(360);
    expect(SCROLL_HINT_TOLERANCE).toBe(2);
  });
});

describe('initialActionBarState', () => {
  it('rend une barre visible dont la référence est le défilement courant, sans verrou', () => {
    expect(initialActionBarState(0)).toEqual({ hidden: false, anchor: 0, lockUntil: 0 });
    expect(initialActionBarState(180)).toEqual({ hidden: false, anchor: 180, lockUntil: 0 });
  });
});

describe('nextActionBarState : barre visible', () => {
  it('se masque quand on descend de plus de 24 px depuis la référence', () => {
    expect(nextActionBarState(visible(100), 125, NOW)).toEqual({
      hidden: true,
      anchor: 125,
      lockUntil: NOW + 360,
    });
  });

  it('reste visible à 24 px pile de descente, et rend l’état reçu', () => {
    const state = visible(100);
    expect(nextActionBarState(state, 124, NOW)).toBe(state);
  });

  it('reste visible sans mouvement', () => {
    const state = visible(100);
    expect(nextActionBarState(state, 100, NOW)).toBe(state);
  });

  it('ne se masque pas dans les 24 premiers pixels de la page, même après une descente rapide', () => {
    const state = visible(-10);
    expect(nextActionBarState(state, 24, NOW)).toBe(state);
    expect(nextActionBarState(state, 25, NOW)).toEqual({
      hidden: true,
      anchor: 25,
      lockUntil: NOW + 360,
    });
  });

  it('ramène la référence quand on remonte, sans changer l’état de la barre', () => {
    expect(nextActionBarState(visible(100, 5), 90, NOW)).toEqual({
      hidden: false,
      anchor: 90,
      lockUntil: 5,
    });
  });

  it('se masque ensuite depuis la nouvelle référence (descente après une remontée)', () => {
    const afterUp = nextActionBarState(visible(300), 200, NOW);
    expect(nextActionBarState(afterUp, 224, NOW)).toBe(afterUp);
    expect(nextActionBarState(afterUp, 225, NOW)).toEqual({
      hidden: true,
      anchor: 225,
      lockUntil: NOW + 360,
    });
  });
});

describe('nextActionBarState : barre masquée', () => {
  it('revient quand on remonte de plus de 24 px depuis la référence', () => {
    expect(nextActionBarState(hidden(300), 275, NOW)).toEqual({
      hidden: false,
      anchor: 275,
      lockUntil: NOW + 360,
    });
  });

  it('reste masquée à 24 px pile de remontée, et rend l’état reçu', () => {
    const state = hidden(300);
    expect(nextActionBarState(state, 276, NOW)).toBe(state);
  });

  it('revient dès qu’on est dans les 24 premiers pixels de la page, même après un petit mouvement', () => {
    expect(nextActionBarState(hidden(30), 23, NOW)).toEqual({
      hidden: false,
      anchor: 23,
      lockUntil: NOW + 360,
    });
  });

  it('reste masquée à 24 px de la page exactement', () => {
    const state = hidden(30);
    expect(nextActionBarState(state, 24, NOW)).toBe(state);
  });

  it('revient en haut de page sans mouvement (position égale à la référence, sous 24 px)', () => {
    expect(nextActionBarState(hidden(10), 10, NOW)).toEqual({
      hidden: false,
      anchor: 10,
      lockUntil: NOW + 360,
    });
  });

  it('reste masquée sans mouvement plus bas dans la page, et rend l’état reçu', () => {
    const state = hidden(300);
    expect(nextActionBarState(state, 300, NOW)).toBe(state);
  });

  it('ramène la référence quand on continue de descendre, sans afficher la barre', () => {
    expect(nextActionBarState(hidden(300, 5), 340, NOW)).toEqual({
      hidden: true,
      anchor: 340,
      lockUntil: 5,
    });
  });
});

describe('nextActionBarState : verrou', () => {
  it('ignore toute bascule pendant 360 ms et ne fait que suivre la référence', () => {
    const lockUntil = NOW + 100;
    expect(nextActionBarState(visible(0, lockUntil), 500, NOW)).toEqual({
      hidden: false,
      anchor: 500,
      lockUntil,
    });
    expect(nextActionBarState(hidden(500, lockUntil), 0, NOW)).toEqual({
      hidden: true,
      anchor: 0,
      lockUntil,
    });
  });

  it('autorise la bascule à l’instant exact de la fin du verrou', () => {
    expect(nextActionBarState(visible(0, NOW), 100, NOW)).toEqual({
      hidden: true,
      anchor: 100,
      lockUntil: NOW + 360,
    });
  });

  it('refuse encore une milliseconde avant la fin du verrou', () => {
    expect(nextActionBarState(visible(0, NOW + 1), 100, NOW)).toEqual({
      hidden: false,
      anchor: 100,
      lockUntil: NOW + 1,
    });
  });

  it('rejoue la scène : bascule, rebond immédiat ignoré, bascule retour après le verrou', () => {
    const shown = visible(0);
    const gone = nextActionBarState(shown, 200, NOW);
    expect(gone.hidden).toBe(true);
    // Rebond de la page en bas de course, 100 ms plus tard : ignoré.
    const bounced = nextActionBarState(gone, 150, NOW + 100);
    expect(bounced).toEqual({ hidden: true, anchor: 150, lockUntil: NOW + 360 });
    // Après le verrou, une remontée de plus de 24 px ramène la barre.
    expect(nextActionBarState(bounced, 100, NOW + 400)).toEqual({
      hidden: false,
      anchor: 100,
      lockUntil: NOW + 400 + 360,
    });
  });
});

describe('hasHiddenContent', () => {
  it('est vrai quand plus de 2 px restent sous le bord bas', () => {
    expect(hasHiddenContent({ scrollHeight: 1000, scrollTop: 0, clientHeight: 600 })).toBe(true);
    expect(hasHiddenContent({ scrollHeight: 603, scrollTop: 0, clientHeight: 600 })).toBe(true);
  });

  it('est faux à 2 px pile de reste ou moins (arrondis de mesure)', () => {
    expect(hasHiddenContent({ scrollHeight: 602, scrollTop: 0, clientHeight: 600 })).toBe(false);
    expect(hasHiddenContent({ scrollHeight: 600, scrollTop: 0, clientHeight: 600 })).toBe(false);
    expect(hasHiddenContent({ scrollHeight: 590, scrollTop: 0, clientHeight: 600 })).toBe(false);
  });

  it('tient compte de la position de défilement', () => {
    expect(hasHiddenContent({ scrollHeight: 1000, scrollTop: 300, clientHeight: 600 })).toBe(true);
    expect(hasHiddenContent({ scrollHeight: 1000, scrollTop: 398, clientHeight: 600 })).toBe(false);
    expect(hasHiddenContent({ scrollHeight: 1000, scrollTop: 400, clientHeight: 600 })).toBe(false);
  });
});
