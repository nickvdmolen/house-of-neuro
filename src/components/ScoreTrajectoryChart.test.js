import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreTrajectoryChart from './ScoreTrajectoryChart';

const students = [
  { id: 'ada', name: 'Ada', points: 500 },
  { id: 'bo', name: 'Bo', points: 120 },
];
const awards = [
  {
    id: 'ada-award',
    ts: '2026-01-10T10:00:00Z',
    target: 'student',
    target_id: 'ada',
    amount: 10,
  },
  {
    id: 'bo-award',
    ts: '2026-01-11T10:00:00Z',
    target: 'student',
    target_id: 'bo',
    amount: 20,
  },
];

describe('ScoreTrajectoryChart', () => {
  let container;
  let root;
  let resizeObservers;
  let dateNowSpy;
  let measuredWidth;
  let rectSpy;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-02-01T12:00:00Z').getTime());
    measuredWidth = 640;
    rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ width: measuredWidth }));
    resizeObservers = [];
    global.ResizeObserver = class ResizeObserver {
      constructor(callback) {
        this.callback = callback;
        this.observe = jest.fn();
        this.disconnect = jest.fn();
        resizeObservers.push(this);
      }
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    dateNowSpy.mockRestore();
    rectSpy.mockRestore();
    delete global.ResizeObserver;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  const renderChart = (props = {}) => {
    act(() => {
      root.render(
        <ScoreTrajectoryChart students={students} awards={awards} {...props} />
      );
    });
  };

  test('recovers responsive measurement after loading and error states', () => {
    renderChart({ historyLoading: true });
    expect(container.textContent).toContain('Scorehistorie laden');
    expect(resizeObservers).toHaveLength(0);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('.score-summary-table')).toBeNull();

    renderChart({ historyLoading: false, historyError: new Error('offline') });
    expect(container.textContent).toContain('kon niet worden geladen');
    expect(resizeObservers).toHaveLength(0);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('.score-summary-table')).toBeNull();

    renderChart({ historyLoading: false, historyError: null });
    expect(container.querySelector('svg')).not.toBeNull();
    expect(resizeObservers).toHaveLength(1);
    expect(resizeObservers[0].observe).toHaveBeenCalledTimes(1);

    measuredWidth = 390;
    act(() => resizeObservers[0].callback([], resizeObservers[0]));
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 390 320');

    const activeObserver = resizeObservers[0];
    renderChart({ historyError: new Error('offline') });
    expect(activeObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(container.querySelector('svg')).toBeNull();

    renderChart();
    expect(resizeObservers).toHaveLength(2);
    expect(resizeObservers[1].observe).toHaveBeenCalledTimes(1);
  });

  test('filters the plot and summary when a student is selected', () => {
    renderChart();

    expect(container.querySelectorAll('.score-summary-table tbody tr')).toHaveLength(2);
    expect(container.querySelectorAll('svg path')).toHaveLength(2);
    expect(container.querySelectorAll('.score-change-marker[tabindex="0"]')).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll('svg text')).map((node) => node.textContent)
    ).toContain('0');

    const select = container.querySelector('#score-chart-student');
    act(() => {
      select.value = 'ada';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const summaryRows = container.querySelectorAll('.score-summary-table tbody tr');
    expect(summaryRows).toHaveLength(1);
    expect(summaryRows[0].textContent).toContain('Ada');
    expect(summaryRows[0].textContent).not.toContain('Bo');
    expect(container.querySelectorAll('svg path')).toHaveLength(1);
    expect(container.querySelectorAll('.score-change-marker[tabindex="0"]')).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll('svg text')).map((node) => node.textContent)
    ).not.toContain('0');
  });

  test('uses the complete semester period and marks today with remaining time', () => {
    renderChart({
      semester: {
        id: 'semester-1',
        name: 'Voorjaar 2026',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      },
    });

    expect(container.textContent).toContain('Voorjaar 2026');
    expect(container.textContent).toContain('Nog 21 weken en 2 dagen');
    expect(container.textContent).toContain('Vandaag');
    expect(container.querySelector('svg rect')).not.toBeNull();
    expect(container.querySelector('svg desc').textContent).toContain(
      'start tot en met het einde van het semester'
    );
  });
});
