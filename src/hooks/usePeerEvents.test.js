import { peerEventFromDb, peerEventToDb } from './usePeerEvents';

describe('peer event database mapping', () => {
  test.each([
    ['all', true, true],
    ['own_group', true, false],
    ['other_groups', false, true],
  ])('preserves the legacy %s recipient scope as boolean flags', (scope, own, other) => {
    const mapped = peerEventFromDb({
      id: 'event-1',
      recipientScope: scope,
    });

    expect(mapped).toMatchObject({
      recipientScope: scope,
      allowOwnGroup: own,
      allowOtherGroups: other,
    });
    expect(peerEventToDb(mapped)).toMatchObject({
      allow_own_group: own,
      allow_other_groups: other,
    });
  });

  test('uses current database flags when there is no recognized legacy scope', () => {
    expect(
      peerEventFromDb({
        id: 'event-1',
        allow_own_group: false,
        allow_other_groups: false,
      })
    ).toMatchObject({ allowOwnGroup: false, allowOtherGroups: false });
  });
});
