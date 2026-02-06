import {
	feature,
	product,
	featureItem,
	pricedFeatureItem,
	priceItem,
} from "atmn";

// Features
export const premium = feature({
	id: "premium",
	name: "Premium Messages",
	type: "single_use",
});

export const standard = feature({
	id: "standard",
	name: "Standard Messages",
	type: "single_use",
});

export const preUserUsage = feature({
	id: "pre_user_usage",
	name: "Pre User Usage",
	type: "boolean",
});

export const seats = feature({
	id: "seats",
	name: "Seats",
	type: "continuous_use",
});

// Products
export const enterprise = product({
	id: "enterprise",
	name: "enterprise",
	items: [
		featureItem({
			feature_id: preUserUsage.id,
			included_usage: 0,
		}),

		featureItem({
			feature_id: premium.id,
			included_usage: 100,
			interval: "month",
		}),

		featureItem({
			feature_id: seats.id,
			included_usage: 1,
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 1000,
			interval: "month",
		}),
	],
});

export const free = product({
	id: "free",
	name: "Free",
	group: "Sub",
	is_default: true,
	items: [
		featureItem({
			feature_id: premium.id,
			included_usage: 5,
			interval: "month",
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 20,
			interval: "month",
		}),
	],
});

export const plus = product({
	id: "plus",
	name: "plus",
	group: "Sub",
	items: [
		priceItem({
			price: 190,
			interval: "month",
		}),

		featureItem({
			feature_id: premium.id,
			included_usage: 100,
			interval: "month",
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 1000,
			interval: "month",
		}),
	],
});

export const pro = product({
	id: "pro",
	name: "pro",
	group: "Sub",
	items: [
		priceItem({
			price: 490,
			interval: "month",
		}),

		featureItem({
			feature_id: premium.id,
			included_usage: 270,
			interval: "month",
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 2700,
			interval: "month",
		}),
	],
});
