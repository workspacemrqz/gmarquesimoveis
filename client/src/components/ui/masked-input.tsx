import InputMask from "react-input-mask";
import { NumericFormat } from "react-number-format";
import { Input } from "./input";
import { forwardRef } from "react";

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    return (
      <InputMask
        mask="(99) 99999-9999"
        value={value}
        onChange={onChange}
        maskChar=""
      >
        {(inputProps: any) => (
          <Input
            {...inputProps}
            {...props}
            ref={ref}
            type="tel"
            placeholder="(11) 99999-9999"
          />
        )}
      </InputMask>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

interface PriceInputProps {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  ({ value, onChange, placeholder, ...props }, ref) => {
    return (
      <NumericFormat
        customInput={Input}
        value={value}
        onValueChange={(values) => {
          if (onChange) {
            onChange(values.floatValue);
          }
        }}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        fixedDecimalScale
        prefix="R$ "
        placeholder={placeholder || "R$ 0,00"}
        getInputRef={ref}
        {...props}
      />
    );
  }
);
PriceInput.displayName = "PriceInput";

interface AreaInputProps {
  value?: number | string;
  onChange?: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export const AreaInput = forwardRef<HTMLInputElement, AreaInputProps>(
  ({ value, onChange, placeholder, ...props }, ref) => {
    return (
      <NumericFormat
        customInput={Input}
        value={value}
        onValueChange={(values) => {
          if (onChange) {
            onChange(values.floatValue);
          }
        }}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        fixedDecimalScale={false}
        suffix=" m²"
        placeholder={placeholder || "0,00 m²"}
        getInputRef={ref}
        {...props}
      />
    );
  }
);
AreaInput.displayName = "AreaInput";

interface CepInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CepInput = forwardRef<HTMLInputElement, CepInputProps>(
  ({ value, onChange, ...props }, ref) => {
    return (
      <InputMask
        mask="99999-999"
        value={value}
        onChange={onChange}
        maskChar=""
      >
        {(inputProps: any) => (
          <Input
            {...inputProps}
            {...props}
            ref={ref}
            placeholder="00000-000"
          />
        )}
      </InputMask>
    );
  }
);
CepInput.displayName = "CepInput";

interface CpfCnpjInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CpfCnpjInput = forwardRef<HTMLInputElement, CpfCnpjInputProps>(
  ({ value = "", onChange, ...props }, ref) => {
    const cleanValue = value.replace(/\D/g, "");
    const mask = cleanValue.length <= 11 
      ? "999.999.999-99" 
      : "99.999.999/9999-99";
    
    return (
      <InputMask
        mask={mask}
        value={value}
        onChange={onChange}
        maskChar=""
      >
        {(inputProps: any) => (
          <Input
            {...inputProps}
            {...props}
            ref={ref}
            placeholder="CPF ou CNPJ"
          />
        )}
      </InputMask>
    );
  }
);
CpfCnpjInput.displayName = "CpfCnpjInput";