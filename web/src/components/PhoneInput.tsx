import { forwardRef } from 'react'
import RPNInput, {
  type Country,
  type Value,
  getCountryCallingCode,
} from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'

interface PhoneInputProps {
  value: Value | undefined
  onChange: (value: Value | undefined) => void
  disabled?: boolean
}

export function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  return (
    <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-transparent">
      <RPNInput
        international
        defaultCountry="US"
        value={value}
        onChange={onChange}
        disabled={disabled}
        countrySelectComponent={CountrySelect}
        inputComponent={PhoneNumberInput}
        className="flex w-full"
      />
    </div>
  )
}

const CountrySelect = ({
  value,
  onChange,
  disabled,
}: {
  value: Country
  onChange: (country: Country) => void
  disabled?: boolean
  options: { value: Country | undefined; label: string }[]
}) => {
  const Flag = value ? flags[value] : null

  return (
    <div className="relative flex-shrink-0">
      <select
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        value={value || ''}
        onChange={e => onChange(e.target.value as Country)}
        disabled={disabled}
        aria-label="Country code"
      />
      <div className="flex items-center gap-1 px-3 h-full border-r border-gray-200 bg-gray-50 select-none pointer-events-none">
        {Flag ? (
          <span className="w-5 h-4 overflow-hidden rounded-sm flex-shrink-0">
            <Flag title={value} />
          </span>
        ) : (
          <span className="w-5 h-4 bg-gray-200 rounded-sm flex-shrink-0" />
        )}
        <span className="text-sm text-gray-500">
          {value ? `+${getCountryCallingCode(value)}` : ''}
        </span>
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

const PhoneNumberInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className="flex-1 px-4 py-3 text-gray-900 placeholder-gray-400 bg-white focus:outline-none text-base min-w-0"
      placeholder="(415) 000-0000"
      {...props}
    />
  )
)
PhoneNumberInput.displayName = 'PhoneNumberInput'
