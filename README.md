# Ludo Betting Commission & Winning Models

## Commission Model

The platform uses a **Game-Level Commission** model.

In this approach, the platform deducts a **fixed commission (rake)** from the total entry fees collected for the game before distributing winnings.

### Why Game-Level Commission

**Advantages**

* **Simple calculation** – Commission is calculated once per game.
* **Transparent** – Players can clearly see the total prize pool after deduction.
* **Consistent payouts** – All payouts come from the same prize pool.

---

# Game Setup (Example)

| Parameter             | Value |
| --------------------- | ----- |
| Players               | 4     |
| Entry fee per player  | ₹500  |
| Total entry pool      | ₹2000 |
| House rake (10%)      | ₹200  |
| Prize pool after rake | ₹1800 |

Calculation:

```
Total Pool = Entry Fee × Players
Total Pool = 500 × 4 = ₹2000

Rake (10%) = ₹200

Prize Pool = ₹2000 − ₹200 = ₹1800
```

All winnings are distributed from the **₹1800 prize pool**.

---

# Winning Models

## 1. Winner Takes All

Only the **1st place player** receives the entire prize pool.

### Distribution

| Position | Actual Amount (Before Rake) | Amount After Rake |
| -------- | --------------------------- | ----------------- |
| 1st      | ₹2000                       | ₹1800             |
| 2nd      | ₹0                          | ₹0                |
| 3rd      | ₹0                          | ₹0                |
| 4th      | ₹0                          | ₹0                |

---

# 2. Top 2 Winners (70 / 30)

The **top 2 players** receive winnings.

* 1st place → 70%
* 2nd place → 30%

### Distribution

| Position | Actual Amount (Before Rake) | Amount After Rake |
| -------- | --------------------------- | ----------------- |
| 1st      | ₹1400                       | ₹1260             |
| 2nd      | ₹600                        | ₹540              |
| 3rd      | ₹0                          | ₹0                |
| 4th      | ₹0                          | ₹0                |

---

# 3. Top 3 Winners (50 / 30 / 20)

The **top 3 players** receive winnings based on position.

* 1st → 50%
* 2nd → 30%
* 3rd → 20%

### Distribution

| Position | Actual Amount (Before Rake) | Amount After Rake |
| -------- | --------------------------- | ----------------- |
| 1st      | ₹1000                       | ₹900              |
| 2nd      | ₹600                        | ₹540              |
| 3rd      | ₹400                        | ₹360              |
| 4th      | ₹0                          | ₹0                |

---

# 4. Double Winner (50 / 50)

The **top 2 players split the prize pool equally**.

### Distribution

| Position | Actual Amount (Before Rake) | Amount After Rake |
| -------- | --------------------------- | ----------------- |
| 1st      | ₹1000                       | ₹900              |
| 2nd      | ₹1000                       | ₹900              |
| 3rd      | ₹0                          | ₹0                |
| 4th      | ₹0                          | ₹0                |

---

# 5. Psychological Model (60 / 25 / 15)

This model **rewards the winner more heavily**, while still giving smaller payouts to 2nd and 3rd place.

* 1st → 60%
* 2nd → 25%
* 3rd → 15%

### Distribution

| Position | Actual Amount (Before Rake) | Amount After Rake |
| -------- | --------------------------- | ----------------- |
| 1st      | ₹1200                       | ₹1080             |
| 2nd      | ₹500                        | ₹450              |
| 3rd      | ₹300                        | ₹270              |
| 4th      | ₹0                          | ₹0                |

---

# Summary

| Model                   | Winners | Risk Level |
| ----------------------- | ------- | ---------- |
| Winner Takes All        | 1       | Very High  |
| Top 2 (70/30)           | 2       | High       |
| Top 3 (50/30/20)        | 3       | Medium     |
| Double Winner (50/50)   | 2       | Low        |
| Psycho Model (60/25/15) | 3       | Medium     |

---
