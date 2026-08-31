import { PagedInfoScene, type InfoPage } from './PagedInfoScene';

/** A quick, dense reference card - How To Play is the friendly walkthrough,
 * this is the "just remind me of the rule" cheat-sheet. */
export class RulesScene extends PagedInfoScene {
  constructor() {
    super('Rules');
  }

  protected getHeading(): string {
    return 'RULES REFERENCE';
  }

  protected getPages(): InfoPage[] {
    return [
      {
        title: 'Dice',
        lines: [
          '• Gati Pasa: Dev / Manushya / Tiryanch / Narak. Only Manushya lets you',
          '  bring ANY ONE yard Kukri onto the board - it is not tied to a specific Kukri.',
          '• Normal Pasa: 1-6, moves an active Kukri that many steps.',
        ],
      },
      {
        title: 'Extra Turns',
        lines: [
          '• Rolling a 6 grants an extra turn.',
          '• Capturing an opponent grants an extra turn.',
          '• Reaching Moksha grants an extra turn.',
          '• Only ONE bonus turn is granted per move, even if several trigger at once.',
        ],
      },
      {
        title: 'Movement & Capture',
        lines: [
          '• You must land on Moksha with an exact roll - overshooting is illegal.',
          '• Landing on an unsafe square with a single opponent captures it home.',
          '• Gold star squares are safe - no capture there.',
          '• 2+ of one opponent color on a square blocks that square entirely.',
          '• Your own Kukri may freely share a square.',
        ],
      },
      {
        title: 'Winning',
        lines: ['• The first player to bring all 4 Kukri to Moksha wins immediately.'],
      },
    ];
  }
}
