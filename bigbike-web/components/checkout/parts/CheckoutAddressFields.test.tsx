import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { CheckoutAddressFields } from "./CheckoutAddressFields";
import {
  createCheckoutAddressSchema,
  type CheckoutAddressFormValues,
} from "@/lib/schemas/checkout";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const defaults: CheckoutAddressFormValues = {
  fullName: "",
  phone: "",
  email: "",
  country: "VN",
  province: "Thành phố Hồ Chí Minh",
  ward: "Phường Sài Gòn",
  addressLine1: "",
};

function AddressHarness() {
  const [vnValue, setVnValue] = useState({
    province: defaults.province,
    ward: defaults.ward,
  });
  const {
    register,
    setValue,
    getValues,
    getFieldState,
    formState: { errors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema((key) => key, true)),
    defaultValues: defaults,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  return (
    <CheckoutAddressFields
      idPrefix="billing"
      autoCompletePrefix=""
      register={register}
      errors={errors}
      includeEmail
      vnValue={vnValue}
      onVnChange={(field, value) => {
        setVnValue((current) =>
          field === "province" ? { province: value, ward: "" } : { ...current, ward: value },
        );
        setValue(field, value, { shouldValidate: getFieldState(field).isTouched });
      }}
      onVnBlur={(field) =>
        setValue(field, getValues(field) ?? vnValue[field], {
          shouldTouch: true,
          shouldValidate: true,
        })
      }
    />
  );
}

describe("CheckoutAddressFields blur validation", () => {
  it("keeps untouched fields quiet, validates on blur, and clears a fixed value on change", async () => {
    render(<AddressHarness />);

    expect(screen.queryByText("fullNameRequired")).not.toBeInTheDocument();
    expect(screen.queryByText("phoneInvalid")).not.toBeInTheDocument();

    const fullName = screen.getByLabelText(/fullName/);
    fireEvent.blur(fullName);
    await screen.findByText("fullNameRequired");
    expect(screen.queryByText("phoneInvalid")).not.toBeInTheDocument();

    fireEvent.change(fullName, { target: { value: "Nguyễn An" } });
    await waitFor(() => expect(screen.queryByText("fullNameRequired")).not.toBeInTheDocument());
  });
});
