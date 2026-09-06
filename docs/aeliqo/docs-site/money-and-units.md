# Money, units and valid comparisons

Suggested opening: Changing the display to a different locale does not convert a currency. A monetary value has an amount and a currency; a price also has a basis such as per request, per image, or per million input tokens.

## The three operations

Formatting: `10.50 USD` may be displayed in another locale without changing its underlying value or currency. Normalization: prices with the same meaning can be represented on the same quantity basis using a declared conversion of units. Foreign exchange: changing USD to IDR requires an explicit rate, source, effective date and rounding policy. These are different operations in the contract.

## A visible failure is better than a wrong total

A collection containing USD and IDR cannot be added as plain numbers. Display separate-currency totals or use an approved conversion and show the provenance. Missing values are not zero. A rate must aggregate through its numerator and denominator, not an average of already computed percentages unless that meaning was expressly defined.

## Page examples

Use synthetic exact amounts to demonstrate round-trip formatting, mixed-currency rejection, approved fixture conversion and ratio-of-sums. Display the result together with units, scope and policy. The FX fixture is not a live exchange rate. A keyboard user must reach the same details as a mouse user.

## API reference boundary

Link to the actual descriptor, formatter and DataPort APIs. Explain which constraints are enforced by schema, semantic validator and server authorization. Do not hide correctness rules in an optional advanced guide that the default tutorial contradicts.
