from __future__ import annotations

from _helpers import BackendTestCase
import project_registry


class ProjectRegistryTests(BackendTestCase):
    def test_add_list_get_and_remove_project(self):
        project_dir = self.tmp_path / "project-a"
        project_dir.mkdir()

        added = project_registry.add_project("alpha", str(project_dir))
        self.assertEqual("alpha", added["name"])
        self.assertEqual(str(project_dir.resolve()), added["path"])

        self.assertEqual(1, len(project_registry.list_projects()))
        self.assertEqual(added, project_registry.get_project("alpha"))

        self.assertTrue(project_registry.remove_project("alpha"))
        self.assertIsNone(project_registry.get_project("alpha"))
        self.assertFalse(project_registry.remove_project("alpha"))

    def test_add_project_requires_existing_directory(self):
        missing_dir = self.tmp_path / "missing"
        with self.assertRaises(ValueError):
            project_registry.add_project("bad", str(missing_dir))
