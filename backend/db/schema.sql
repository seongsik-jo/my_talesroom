CREATE DATABASE IF NOT EXISTS talesroom
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

use talesroom;

CREATE TABLE `users` (
  `id` varchar(100) PRIMARY KEY,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` varchar(20),
  `nickname` varchar(30) NOT NULL,
  `score` integer DEFAULT 0,
  `grade` varchar(20) DEFAULT '방린이',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE TABLE `posts` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `view_count` integer NOT NULL DEFAULT 0,
  `is_spoiler` tinyint NOT NULL DEFAULT 0,
  `is_notice` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE TABLE `posts_logs` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `post_id` integer NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `is_spoiler` tinyint NOT NULL,
  `is_notice` tinyint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `post_reactions` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `post_id` integer NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `comments` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `post_id` integer NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `is_accepted` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `themes` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `title` varchar(150) NOT NULL,
  `store_name` varchar(100) NOT NULL,
  `address` varchar(255) NOT NULL,
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `thumbnail_url` varchar(2048),
  `content` text NOT NULL,
  `min_people` tinyint NOT NULL DEFAULT 0,
  `max_people` tinyint NOT NULL DEFAULT 0,
  `play_time` integer NOT NULL DEFAULT 60,
  `difficulty` tinyint NOT NULL,
  `price` integer NOT NULL DEFAULT 0,
  `genre` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE TABLE `theme_logs` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `theme_id` integer NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `title` varchar(150) NOT NULL,
  `store_name` varchar(100) NOT NULL,
  `address` varchar(255) NOT NULL,
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `thumbnail_url` varchar(2048),
  `content` text NOT NULL,
  `min_people` tinyint NOT NULL,
  `max_people` tinyint NOT NULL,
  `play_time` integer NOT NULL,
  `difficulty` tinyint NOT NULL,
  `price` integer NOT NULL,
  `genre` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `theme_reviews` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `theme_id` integer NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `rating` tinyint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `recruitments` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `theme_id` int,
  `theme_name` varchar(150),
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `meet_date` datetime NOT NULL,
  `capacity` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'OPEN',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE TABLE `recruitment_applications` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `recruitment_id` int NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `party_comments` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `recruitment_id` int NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `bookmarks` (
  `user_id` varchar(100) NOT NULL,
  `theme_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`user_id`, `theme_id`) -- 유저 id, 테마 id (복합 pk)
);

CREATE TABLE `items` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `price` int NOT NULL,
  `stock` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE TABLE `point_exchanges` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `item_id` int NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `used_points` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp
);

CREATE UNIQUE INDEX `uk_users_email` ON `users` (`email`);
CREATE UNIQUE INDEX `uk_users_nickname` ON `users` (`nickname`);
CREATE UNIQUE INDEX `uk_post_reactions_post_id_user_id` ON `post_reactions` (`post_id`, `user_id`);
CREATE UNIQUE INDEX `uk_theme_reviews_theme_id_user_id` ON `theme_reviews` (`theme_id`, `user_id`);
CREATE UNIQUE INDEX `uq_recruitment_user` ON `recruitment_applications` (`recruitment_id`, `user_id`);

CREATE INDEX `idx_posts_created_at` ON `posts` (`created_at`);
CREATE INDEX `idx_comments_created_at` ON `comments` (`created_at`);
CREATE INDEX `idx_themes_created_at` ON `themes` (`created_at`);
CREATE INDEX `idx_theme_reviews_created_at` ON `theme_reviews` (`created_at`);

ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `post_reactions` ADD CONSTRAINT `fk_post_reactions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `post_reactions` ADD CONSTRAINT `fk_post_reactions_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

ALTER TABLE `comments` ADD CONSTRAINT `fk_comments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `comments` ADD CONSTRAINT `fk_comments_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

ALTER TABLE `theme_reviews` ADD CONSTRAINT `fk_theme_reviews_theme_id` FOREIGN KEY (`theme_id`) REFERENCES `themes` (`id`) ON DELETE CASCADE;
ALTER TABLE `theme_reviews` ADD CONSTRAINT `fk_theme_reviews_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `recruitments` ADD CONSTRAINT `fk_recruitments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `recruitments` ADD CONSTRAINT `fk_recruitments_theme_id` FOREIGN KEY (`theme_id`) REFERENCES `themes` (`id`) ON DELETE SET NULL;

ALTER TABLE `recruitment_applications` ADD CONSTRAINT `fk_recruitment_applications_recruitment_id` FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`) ON DELETE CASCADE;
ALTER TABLE `recruitment_applications` ADD CONSTRAINT `fk_recruitment_applications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `party_comments` ADD CONSTRAINT `fk_party_comments_recruitment_id` FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`) ON DELETE CASCADE;
ALTER TABLE `party_comments` ADD CONSTRAINT `fk_party_comments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `bookmarks` ADD CONSTRAINT `fk_bookmarks_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `bookmarks` ADD CONSTRAINT `fk_bookmarks_theme_id` FOREIGN KEY (`theme_id`) REFERENCES `themes` (`id`) ON DELETE CASCADE;

ALTER TABLE `items` ADD CONSTRAINT `fk_items_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);