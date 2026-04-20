# Polsa

Personal finance software

## Features

* I can have multiple accounts
* Accounts are of 4 types:
  * cash
  * checking
  * savings
  * investments
* accounts hold dated transactions, must be performant enought to hold hundreds of transactions per year, going back several years
* accounts have a starting balance
* transactions have the following data:
  * date
  * amount: positive or negative, two decimal
  * a category (see below)
  * description: free text
  * reconciled yes/no (no by default, not viewable on that screen)
* in the account I can view the latest transactions, as an infinite scroll, with the updated account balance on each transaction
* data input must be very user friendly, where it can be very easy to enter multiple transactions one after the other
* dates shown in local short date format (GB: dd/MM/yyyy)
* should be able to import/export on QIF format for an account
* recurring payments (see below) are applied automatically on launch

### Categories

These are structured items hierarchised on two levels. Free text for both levels
On the categories screen I can create/rename/delete categories and sub-categories. I can also see the most recent transactions per category or subcategory, with an infinite scroll downward

### Recurring payments

I can set up a recurring transaction: It has a date for the next transaction, an amount, as well as input for recurrence frequency, and an account to apply it onto. On opening the app, the overdue transactions are added automatically and silently

In the recurring payments set up screen I can see upcoming scheduled payments. I can cancel them or change the amount, and create new ones.

### Reconciliation

A specific screen where I can pick an account to reconcile with my bank statement:
- It would show me the "reconciled" balance: the balanced of existing reconciled transactions
- I can enter a "target" balance amount, which I got from my bank statement
  - I then get the difference between the two calculated and displayed
- It will show me the transactions which are not reconciled yet
- I can select transactions gradually, as I do so it would update the "reconciled" balance, and so the difference would be updated too
- When the "reconciled" matches the "target", the difference arrives at 0, and I have now a button enabled to "Reconcile selected transactions"
- This would mark all the selected transactions as "Reconciled" in their data. The process is completed

This can help performance later as reconciled transactions are considered "older" transactions.

Note: Often I have missing transactions or incorrect values, which I only notice after receiving my bank statement. So on that screen I should also be able to easily add transactions or edit existing ones without leaving that screen.

### Budgets

I want to be able to set up budget allocation per category or sub-category. This would follow a budget enveloppe model, per month, with rolling-over of budget amount left at the end of the month (including negative numbers) over one year. Budget amount left wouldn't carry over to a new calendar year.

The budget screen should allow me to see the total amount allocated for the current month. Each month should repeat by default the previous month's allocated values, but I should be able to overwrite them occasionally. If that happens I should be asked if I want to just update the allocation for this month, or if all subsequent months should also use the new value.

### Stats and reporting

TODO
I want a few important stats:


## UI / UX

Style is slick, modern, cybernetics, dark blue tones UI

## Technical spec

* Local Electron app
* no authentication
* storage local
  * take performance in consideration, as well as ease of setup
  * local files? SqlLite? etc.

## Companion mobile app

* A simple companion mobile app:
  * can be done as progressive web app
  * to store transactions locally on the phone while on the go
    * not the full DB though. Crucially I need the accounts, and maybe current balances
  * no connectivity needed
  * should be able to sync with the desktop when together
    * using bluetooth? QR codes? anything else?

##  Development phases

Phase 1: basics in places, accounts with categories
Phase 2: Recurring payments
Phase 3: Reconciliation
Phase 4: Budgets
Phase 5: companion mobile app
Phase 6: stats and reporting