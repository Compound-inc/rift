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
	name: "Enterprise",
	items: [
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

export const plusApi = product({
	id: "plus_api",
	name: "Plus",
	items: [
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

export const proApi = product({
	id: "pro_api",
	name: "Pro",
	items: [
		featureItem({
			feature_id: premium.id,
			included_usage: 270,
			interval: "month",
		}),

		featureItem({
			feature_id: seats.id,
			included_usage: 1,
		}),

		featureItem({
			feature_id: standard.id,
			included_usage: 2700,
			interval: "month",
		}),
	],
});

export const startup = product({
	id: "startup",
	name: "Startup",
	items: [
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

export const vip = product({
	id: "vip",
	name: "VIP",
	items: [
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
	name: "Plus",
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
	name: "Pro",
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
