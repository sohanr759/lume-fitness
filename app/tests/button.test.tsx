// Tests: components/Button
// Verifies onPress fires, impact is called, and undefined onPress is handled safely

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/Button';

jest.mock('@/lib/haptics', () => ({
  impact: jest.fn(),
}));

import { impact } from '@/lib/haptics';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Button', () => {
  it('renders the label', () => {
    const { getByText } = render(<Button label="Sign In" />);
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Sign In" onPress={onPress} />);
    fireEvent.press(getByText('Sign In'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls impact() on every press', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Sign In" onPress={onPress} />);
    fireEvent.press(getByText('Sign In'));
    expect(impact).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onPress is undefined', () => {
    const { getByText } = render(<Button label="Sign In" />);
    expect(() => fireEvent.press(getByText('Sign In'))).not.toThrow();
  });

  it('still fires impact when onPress is undefined', () => {
    const { getByText } = render(<Button label="Sign In" />);
    fireEvent.press(getByText('Sign In'));
    expect(impact).toHaveBeenCalledTimes(1);
  });

  it('renders with ghost variant', () => {
    const { getByText } = render(<Button label="Cancel" variant="ghost" />);
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('fires onPress multiple times on repeated presses', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Go" onPress={onPress} />);
    fireEvent.press(getByText('Go'));
    fireEvent.press(getByText('Go'));
    fireEvent.press(getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(3);
  });
});
