// @vitest-environment jsdom
// apps/web/test/unit/components/form/form-components.test.tsx
import { render, screen } from '@testing-library/react';
import {
  FormErrorDisplay,
  FormSubmitButton,
  ValidatedField,
} from '@workspace/components/form';

// ---------------------------------------------------------------------------
// Helpers: minimal fake form/field APIs
// ---------------------------------------------------------------------------

/**
 * Builds a fake AnyReactFormApi whose `Subscribe` render-prop calls `children`
 * with the value returned by `selector(state)`.
 */
function makeFakeForm(state: Record<string, unknown>) {
  return {
    Subscribe: ({
      selector,
      children,
    }: {
      selector: (s: Record<string, unknown>) => unknown;
      children: (value: unknown) => React.ReactNode;
    }) => <>{children(selector(state))}</>,
  };
}

/**
 * Builds a fake AnyFieldApi with controlled meta values.
 */
function makeFakeField({
  errors = [] as Array<unknown>,
  isBlurred = false,
  isValid = true,
  name = 'testField',
} = {}) {
  return {
    name,
    state: {
      meta: {
        errors,
        isBlurred,
        isValid,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// FormErrorDisplay
// ---------------------------------------------------------------------------

describe('FormErrorDisplay', () => {
  it('renders nothing when form has no errors', () => {
    const form = makeFakeForm({ errors: [] });
    const { container } = render(<FormErrorDisplay form={form as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when errors array contains only non-string values', () => {
    const form = makeFakeForm({ errors: [{ message: 'obj error' }, null, 42] });
    const { container } = render(<FormErrorDisplay form={form as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error message for a single string error', () => {
    const form = makeFakeForm({ errors: ['Something went wrong'] });
    render(<FormErrorDisplay form={form as never} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders all string errors when form has multiple', () => {
    const form = makeFakeForm({ errors: ['First error', 'Second error'] });
    render(<FormErrorDisplay form={form as never} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'First error, Second error'
    );
  });

  it('filters out non-string values from a mixed error array', () => {
    const form = makeFakeForm({
      errors: ['Valid error', { message: 'obj' }, null, 'Another error'],
    });
    render(<FormErrorDisplay form={form as never} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Valid error, Another error'
    );
  });
});

// ---------------------------------------------------------------------------
// FormSubmitButton
// ---------------------------------------------------------------------------

describe('FormSubmitButton', () => {
  it('renders a button with the given label text', () => {
    const form = makeFakeForm({ isSubmitting: false });
    render(<FormSubmitButton form={form as never} label="Save" />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('button has type="submit"', () => {
    const form = makeFakeForm({ isSubmitting: false });
    render(<FormSubmitButton form={form as never} label="Submit" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('button is enabled when not submitting and disabled prop is absent', () => {
    const form = makeFakeForm({ isSubmitting: false });
    render(<FormSubmitButton form={form as never} label="Go" />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('button is disabled when isSubmitting is true', () => {
    const form = makeFakeForm({ isSubmitting: true });
    render(<FormSubmitButton form={form as never} label="Go" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('button is disabled when disabled prop is true', () => {
    const form = makeFakeForm({ isSubmitting: false });
    render(<FormSubmitButton form={form as never} label="Go" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('loader icon is visible when isSubmitting is true', () => {
    const form = makeFakeForm({ isSubmitting: true });
    render(<FormSubmitButton form={form as never} label="Go" />);
    expect(screen.getByTestId('submit-loader')).toBeInTheDocument();
  });

  it('loader icon is absent when not submitting', () => {
    const form = makeFakeForm({ isSubmitting: false });
    render(<FormSubmitButton form={form as never} label="Go" />);
    expect(screen.queryByTestId('submit-loader')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ValidatedField
// ---------------------------------------------------------------------------

describe('ValidatedField', () => {
  it('always renders children', () => {
    const field = makeFakeField();
    render(
      <ValidatedField field={field as never}>
        <input data-testid="child-input" />
      </ValidatedField>
    );
    expect(screen.getByTestId('child-input')).toBeInTheDocument();
  });

  it('renders label when label prop provided', () => {
    const field = makeFakeField({ name: 'email' });
    render(
      <ValidatedField field={field as never} label="Email">
        <input />
      </ValidatedField>
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('omits label element when label prop absent', () => {
    const field = makeFakeField({ name: 'email' });
    const { container } = render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    // No label element should be rendered when the label prop is absent.
    expect(container.querySelector('label')).toBeNull();
  });

  it('does not show error when field is valid (empty errors)', () => {
    const field = makeFakeField({ errors: [], isBlurred: true, isValid: true });
    const { container } = render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const fieldEl = container.querySelector('[data-slot="field"]');
    expect(fieldEl).toHaveAttribute('data-invalid', 'false');
  });

  it('does not show error when field is invalid but not yet blurred', () => {
    const field = makeFakeField({
      errors: ['Required'],
      isBlurred: false,
      isValid: false,
    });
    render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows error when field is invalid AND blurred', () => {
    const field = makeFakeField({
      errors: ['Required'],
      isBlurred: true,
      isValid: false,
    });
    render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('sets data-invalid attribute when field has errors and is blurred', () => {
    const field = makeFakeField({
      errors: ['Bad value'],
      isBlurred: true,
      isValid: false,
    });
    const { container } = render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    const fieldEl = container.querySelector('[data-slot="field"]');
    expect(fieldEl).toHaveAttribute('data-invalid', 'true');
  });

  it('error text passes through toFieldErrorItem transformation', () => {
    // toFieldErrorItem converts string errors to { message: string } objects.
    // FieldError renders the message string in an alert div.
    const field = makeFakeField({
      errors: ['Must be at least 8 characters'],
      isBlurred: true,
      isValid: false,
    });
    render(
      <ValidatedField field={field as never}>
        <input />
      </ValidatedField>
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Must be at least 8 characters'
    );
  });
});
